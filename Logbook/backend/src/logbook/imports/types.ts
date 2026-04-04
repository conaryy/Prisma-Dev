export type ImportLogbookParams = {
  fileName: string;
  buffer: Buffer;
  sourcePeriod?: string;
  importedBy?: string;
};

export type ParsedTeknikRow = {
  entryNo: number;
  entryDate: Date;
  entryTime: string;
  equipment: string;
  frequencySection: string;
  incident: string;
  sourceRowNumber: number;
};

export type ParsedAppRow = {
  entryNo: number;
  entryDate: Date;
  entryTime: string;
  operationType: string;
  facility: string;
  callSign: string;
  description: string;
  sourceRowNumber: number;
};

export type ParsedTowerRow = {
  entryNo: number;
  entryDate: Date;
  entryTime: string;
  operationType: string;
  facility: string;
  callSign: string;
  description: string;
  sourceRowNumber: number;
};
