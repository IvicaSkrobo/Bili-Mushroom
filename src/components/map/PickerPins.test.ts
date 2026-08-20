import { describe, it, expect } from 'vitest';
import { pickedLocationNote } from './PickerPins';

/**
 * Clicking an existing pin in the location picker copies its coordinates, its label and
 * its location note onto the find being created. The note used to travel on the full
 * find record; once the map moved to a lean payload it had to be carried deliberately,
 * and nothing failed loudly when it was not.
 */
describe('pickedLocationNote', () => {
  it('adopts the note when every find at that spot agrees', () => {
    const species = [
      { finds: [{ location_note: 'Ucka, sjeverna padina' }] },
      { finds: [{ location_note: '  Ucka, sjeverna padina  ' }] },
    ];
    expect(pickedLocationNote(species)).toBe('Ucka, sjeverna padina');
  });

  it('adopts nothing when the finds there disagree', () => {
    const species = [
      { finds: [{ location_note: 'Ucka' }] },
      { finds: [{ location_note: 'Gorski kotar' }] },
    ];
    expect(pickedLocationNote(species)).toBeUndefined();
  });

  it('ignores blank and missing notes', () => {
    expect(
      pickedLocationNote([
        { finds: [{ location_note: '   ' }, { location_note: null }, {}] },
        { finds: [{ location_note: 'Ucka' }] },
      ]),
    ).toBe('Ucka');
    expect(pickedLocationNote([{ finds: [{ location_note: '' }] }])).toBeUndefined();
  });

  it('adopts nothing from an empty pin', () => {
    expect(pickedLocationNote([])).toBeUndefined();
  });
});
