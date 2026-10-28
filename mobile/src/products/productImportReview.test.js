import { describe, expect, it } from 'vitest';
import { readProductCsv, reviewProductCsv } from './productImportReview';

describe('local product CSV review', () => {
  it('validates exported columns, UTF-8 BOM, quoted commas, quotes, multiline names and grouped amounts', () => {
    const result = reviewProductCsv('\ufeffName,SKU,Barcode,Cost,Stock,Retail,Wholesale,Base Unit,Purchase Unit,Units per Purchase Unit\r\n"Filter, ""အပို""\nsecond line",,,"1,000",1.5,2000,0,Piece,Box,12\r\n');
    expect(result).toMatchObject({ total: 1, valid: 1, invalid: 0, skipped: 0 });
    expect(result.rows[0]).toMatchObject({ row_number: 2, name: 'Filter, "အပို"\nsecond line', cost: 1000, stock: 1.5 });
    expect(result.rows[0].prices).toContainEqual({ name: 'wholesale', price: 0 });
  });

  it('checks required names, numeric formats, whole-number prices and unit rules', () => {
    const result = reviewProductCsv('Name,Cost,Stock,Retail,Low Stock Alert,Base Unit,Purchase Unit,Units per Purchase Unit\n,100,1,200,0,Piece,,1\nRice,nope,x,1.5,-1,Piece,Piece,1\nTea,100,1,200,0,Piece,Box,1000001');
    expect(result).toMatchObject({ total: 3, valid: 0, invalid: 3 });
    expect(result.rows[0].errors).toContain('Product name is required.');
    expect(result.rows[1].errors).toContain('Purchase unit must be different from the base unit.');
    expect(result.rows[1].errors).toContain('Purchase conversion must be greater than one.');
    expect(result.rows[2].errors.join(' ')).toContain('at most 1000000');
  });

  it('marks repeated codes without matching product names', () => {
    const result = reviewProductCsv('Name,SKU,Barcode\nRice,A,\nRice,a,\nRice,,100\nRice,,100\nRice,,');
    expect(result).toMatchObject({ total: 5, valid: 3, skipped: 2, invalid: 0 });
    expect(result.rows[1].errors).toContain('The sku repeats row 2.');
  });

  it('rejects missing/duplicate headers, malformed quoting, empty files and excessive rows', () => {
    for (const csv of ['Wrong,Cost\nRice,1', 'Name,Name\nRice,Rice', 'Name\n"Unclosed', 'Name\n"Rice"extra', '\n\n']) {
      expect(() => reviewProductCsv(csv)).toThrow();
    }
    expect(() => reviewProductCsv(`Name\n${Array(5001).fill('Rice').join('\n')}`)).toThrow('5,000');
    expect(reviewProductCsv('Name,Cost\n\nRice,1\n')).toMatchObject({ total: 1, rows: [expect.objectContaining({ row_number: 3 })] });
    expect(reviewProductCsv('Name,Cost\nRice,1,extra').invalid).toBe(1);
  });

  it('validates file size, extension and UTF-8 before any upload', async () => {
    await expect(readProductCsv({ name: 'data.xlsx' })).rejects.toThrow('CSV file');
    await expect(readProductCsv({ name: 'data.csv', size: 5 * 1024 * 1024 + 1 })).rejects.toThrow('5 MB');
    await expect(readProductCsv({ name: 'data.csv', size: 1, arrayBuffer: async () => new Uint8Array([0xff]).buffer })).rejects.toThrow('UTF-8');
  });
});
