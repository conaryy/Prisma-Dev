import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryLogbookDto {
  @IsIn(['tower', 'app', 'teknik'])
  category!: 'tower' | 'app' | 'teknik';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
