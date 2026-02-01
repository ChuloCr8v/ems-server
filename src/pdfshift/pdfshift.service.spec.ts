import { Test, TestingModule } from '@nestjs/testing';
import { PdfshiftService } from './pdfshift.service';

describe('PdfshiftService', () => {
  let service: PdfshiftService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PdfshiftService],
    }).compile();

    service = module.get<PdfshiftService>(PdfshiftService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
