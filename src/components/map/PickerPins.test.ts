import { describe, expect, it } from 'vitest';
import { pickedLocationLabel } from './PickerPins';

describe('pickedLocationLabel', () => {
  it('includes every unique species name from a shared pin', () => {
    expect(
      pickedLocationLabel([
        { name: 'Boletus *edulis*' },
        { name: 'Amanita muscaria' },
        { name: 'Cantharellus cibarius' },
      ]),
    ).toBe('Boletus edulis, Amanita muscaria, Cantharellus cibarius');
  });

  it('deduplicates repeated species at the same location', () => {
    expect(
      pickedLocationLabel([
        { name: 'Boletus edulis' },
        { name: 'Boletus edulis' },
        { name: 'Amanita muscaria' },
      ]),
    ).toBe('Boletus edulis, Amanita muscaria');
  });
});
