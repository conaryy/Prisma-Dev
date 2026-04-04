import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ImportLogbookTeknikDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  sourcePeriod?: string;
}
