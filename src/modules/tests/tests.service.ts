import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TestConfig, TestConfigDocument } from './schemas/test-config.schema';
import { CreateTestConfigDto, TestConfigQueryDto } from './dto';
import { UpdateTestConfigDto } from './dto/update-test-config.dto';
import {
  isLanguageSupported,
  getLanguageConfig,
} from '../../common/constants/languages.constant';

@Injectable()
export class TestsService {
  private readonly logger = new Logger(TestsService.name);

  constructor(
    @InjectModel(TestConfig.name)
    private testConfigModel: Model<TestConfigDocument>,
  ) {}

  async create(createDto: CreateTestConfigDto): Promise<TestConfigDocument> {
    // Validate language configuration
    if (!isLanguageSupported(createDto.language.code)) {
      throw new BadRequestException(
        `Language ${createDto.language.code} is not supported`,
      );
    }

    const languageConfig = getLanguageConfig(createDto.language.code);
    if (!languageConfig) {
      throw new BadRequestException('Invalid language configuration');
    }

    // Validate dialect exists for the language
    const dialectExists = languageConfig.dialects.some(
      (d) => d.code === createDto.language.dialect,
    );
    if (!dialectExists) {
      throw new BadRequestException(
        `Dialect ${createDto.language.dialect} is not supported for language ${createDto.language.code}`,
      );
    }

    const testConfig = new this.testConfigModel({
      ...createDto,
      agentType: createDto.agentType || 'phone',
      isActive: createDto.isActive !== undefined ? createDto.isActive : true,
    });

    return testConfig.save();
  }

  async findAll(query: TestConfigQueryDto): Promise<TestConfigDocument[]> {
    const filter: any = {};

    if (query.customerId) {
      filter.customerId = query.customerId;
    }

    if (query.agentId) {
      filter.agentId = query.agentId;
    }

    if (query.language) {
      filter['language.code'] = query.language;
    }

    if (query.isActive !== undefined) {
      filter.isActive = query.isActive;
    }

    if (query.search) {
      filter.name = { $regex: query.search, $options: 'i' };
    }

    const testConfigs = await this.testConfigModel
      .find(filter)
      .sort({ createdAt: -1 })
      .exec();
    // Convert to JSON to ensure ObjectIds are serialized
    return testConfigs.map((config) =>
      config.toJSON ? config.toJSON() : config,
    ) as TestConfigDocument[];
  }

  async findOne(id: string): Promise<TestConfigDocument> {
    const testConfig = await this.testConfigModel.findById(id).exec();

    if (!testConfig) {
      throw new NotFoundException(`Test config with ID ${id} not found`);
    }

    // Convert to JSON to ensure ObjectIds are serialized
    const json = testConfig.toJSON ? testConfig.toJSON() : testConfig;
    return json as TestConfigDocument;
  }

  async update(
    id: string,
    updateDto: UpdateTestConfigDto,
  ): Promise<TestConfigDocument> {
    // Validate language if provided
    if (updateDto.language) {
      if (!isLanguageSupported(updateDto.language.code)) {
        throw new BadRequestException(
          `Language ${updateDto.language.code} is not supported`,
        );
      }

      const languageConfig = getLanguageConfig(updateDto.language.code);
      if (languageConfig && updateDto.language.dialect) {
        const dialectExists = languageConfig.dialects.some(
          (d) => d.code === updateDto.language!.dialect,
        );
        if (!dialectExists) {
          throw new BadRequestException(
            `Dialect ${updateDto.language.dialect} is not supported for language ${updateDto.language.code}`,
          );
        }
      }
    }

    const testConfig = await this.testConfigModel
      .findByIdAndUpdate(id, updateDto, { new: true, runValidators: true })
      .exec();

    if (!testConfig) {
      throw new NotFoundException(`Test config with ID ${id} not found`);
    }

    return testConfig;
  }

  async remove(id: string): Promise<void> {
    const result = await this.testConfigModel.findByIdAndDelete(id).exec();

    if (!result) {
      throw new NotFoundException(`Test config with ID ${id} not found`);
    }
  }
}
