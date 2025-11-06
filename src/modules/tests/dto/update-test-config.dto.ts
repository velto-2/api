import { PartialType } from '@nestjs/swagger';
import { CreateTestConfigDto } from './create-test-config.dto';

export class UpdateTestConfigDto extends PartialType(CreateTestConfigDto) {}


