import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { BaseResponseDto } from '../dto/base-response.dto';

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, BaseResponseDto<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<BaseResponseDto<T>> {
    const request = context.switchToHttp().getRequest();
    
    return next.handle().pipe(
      map(data => {
        // If data is already a BaseResponseDto, return as is
        if (data && typeof data === 'object' && 'success' in data) {
          if (!data.meta) {
            data.meta = {
              timestamp: new Date().toISOString(),
              path: request.url,
              version: '1.0.0',
            };
          }
          return data;
        }

        // Otherwise, wrap in BaseResponseDto
        const response = BaseResponseDto.success('Operation successful', data);
        response.meta = {
          timestamp: new Date().toISOString(),
          path: request.url,
          version: '1.0.0',
        };
        
        return response;
      }),
    );
  }
}