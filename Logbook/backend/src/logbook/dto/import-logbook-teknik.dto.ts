import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class ImportLogbookTeknikDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  sourcePeriod?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  allowReimport?: boolean;
}
