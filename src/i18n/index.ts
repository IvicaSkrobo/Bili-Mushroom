import { useAppStore } from '@/stores/appStore';

export type Lang = 'hr' | 'en';

type Translations = Record<string, string>;

const hr: Translations = {
  // navigation
  'nav.collection': 'Zbirka',
  'nav.map': 'Karta',
  'nav.species': 'Vrste',
  'nav.browse': 'Pretraži',
  'nav.stats': 'Statistike',
  'nav.settings': 'Postavke',

  // collection tab
  'collection.empty.heading': 'Vaša zbirka je prazna',
  'collection.empty.body': 'Uvezite prvi nalaz gljive za početak.',
  'collection.loading': 'Učitavanje nalaza…',
  'collection.importBtn': 'Uvezi fotografije',
  'collection.finds.one': 'nalaz',
  'collection.finds.few': 'nalaza',
  'collection.finds.many': 'nalaza',
  'collection.folderNotes': 'Bilješke o {name}…',
  'collection.imported': 'Uvezeno {n}',
  'collection.skipped': ' · Preskočeno {n}',
  'collection.deletedToast': 'Obrisano {n}',
  'collection.movedToast': 'Premješteno {n} u {name}',
  'collection.selectFinds': 'Odaberi',
  'collection.cancelSelect': 'Odustani',
  'collection.deleteSelected': 'Obriši ({n})',
  'collection.moveToSpecies': 'Premjesti u vrstu…',
  'collection.moveTargetPlaceholder': 'Naziv ciljne vrste',
  'collection.bulkMoveBtn': 'Premjesti {n}',

  // import dialog
  'import.title': 'Uvezi fotografije',
  'import.pickPhotos': 'Odaberi fotografije',
  'import.pickFolder': 'Odaberi mapu',
  'import.clearAll': 'Obriši sve',
  'import.mushroomName': 'Naziv gljive',
  'import.pickLocation': 'Postavi zajedničku lokaciju',
  'import.newFolderHint': 'Nova mapa će biti stvorena',
  'import.date': 'Datum',
  'import.country': 'Država',
  'import.region': 'Regija',
  'import.locationMark': 'Oznaka',
  'import.folderNotes': 'Bilješke mape…',
  'import.nameRequired': 'Sve fotografije moraju imati naziv gljive prije uvoza.',
  'import.importAll': 'Uvezi sve',

  // find preview card
  'preview.speciesName': 'Naziv vrste',
  'preview.dateRequired': 'Datum je obavezan prije uvoza',
  'preview.country': 'Država',
  'preview.region': 'Regija',
  'preview.locationMark': 'Oznaka',
  'preview.setLocation': 'Postavi lokaciju',
  'preview.notes': 'Bilješke',
  'preview.remove': 'Ukloni s popisa',
  'preview.deleteSource': 'Obriši izvornu datoteku',
  'preview.deleteSourceHint': 'Ovo će trajno premjestiti izvornu datoteku u Reciklažu. Jeste li sigurni?',

  // find card
  'findCard.unnamed': '(neimenovano)',
  'findCard.edit': 'Uredi',

  // edit dialog
  'edit.title': 'Uredi nalaz',
  'edit.species': 'Vrsta',
  'edit.date': 'Datum pronalaska',
  'edit.country': 'Država',
  'edit.region': 'Regija',
  'edit.locationMark': 'Oznaka lokacije',
  'edit.locationMarkPlaceholder': 'npr. blizu stare hraste',
  'edit.lat': 'Geografska širina',
  'edit.lng': 'Geografska dužina',
  'edit.notes': 'Bilješke',
  'edit.cancel': 'Odustani',
  'edit.save': 'Spremi',
  'edit.saving': 'Spremanje…',

  // delete dialog
  'delete.title': 'Obrisati nalaz?',
  'delete.recordOnly': 'Obriši samo zapis — zadrži fotografiju na disku',
  'delete.recordAndFiles': 'Obriši zapis + datoteke — premjesti u Reciklažu',
  'delete.moveFiles': 'Premjesti datoteke u drugu mapu',
  'delete.chooseDestFolder': 'Odaberi odredišnu mapu',
  'delete.folderSelected': 'Mapa odabrana ✓',
  'delete.moving': 'Premještanje…',
  'delete.cancel': 'Odustani',
  'delete.confirm': 'Obriši',
  'delete.deleting': 'Brisanje…',
  'delete.successRecord': 'Nalaz obrisan',
  'delete.successFiles': 'Nalaz i datoteke obrisani',

  // settings dialog
  'settings.title': 'Postavke',
  'settings.libraryLocation': 'Lokacija knjižnice gljiva',
  'settings.notSet': '(nije postavljeno)',
  'settings.changeFolder': 'Promijeni mapu',
  'settings.choosing': 'Odabir…',
  'settings.changeFolderHint': 'Promjena mape knjižnice zatražit će premještanje ili kopiranje postojećih podataka.',
  'settings.language': 'Jezik',
  'settings.langHr': 'Hrvatski',
  'settings.langEn': 'English',
  'settings.theme': 'Izgled',
  'settings.themeLight': 'Svijetlo',
  'settings.themeDark': 'Tamno',
  'settings.resetSection': 'Resetiranje aplikacije',
  'settings.resetBtn': 'Resetiraj na početak',
  'settings.resetTitle': 'Resetirati aplikaciju?',
  'settings.resetWarning': 'Ovo će zaboraviti lokaciju knjižnice i vratiti te na početni zaslon. Tvoji nalazi i fotografije na disku neće biti obrisani.',
  'settings.resetConfirm': 'Da, resetiraj',

  // first run dialog
  'firstRun.title': 'Odaberite svoju knjižnicu gljiva',
  'firstRun.description': 'Odaberite mapu gdje će Bili Mushroom pohraniti vaše nalaze, fotografije i bazu podataka. Ovo možete promijeniti kasnije u Postavkama.',
  'firstRun.noFolder': 'Mapa nije odabrana',
  'firstRun.chooseFolder': 'Odaberi mapu',

  // auto-import dialog
  'autoImport.title.scanning': 'Skeniranje knjižnice…',
  'autoImport.title.done': 'Uvoz završen',
  'autoImport.species': 'Uvoz: {name}',
  'autoImport.progress': '{current} / {total} vrsta',
  'autoImport.result.species': 'Pronađeno {n} vrsta',
  'autoImport.result.imported': 'Uvezeno {n} fotografija',
  'autoImport.result.skipped': '{n} već postoji, preskočeno',
  'autoImport.result.empty': 'Nije pronađena nijedna podmapa s fotografijama.',
  'autoImport.done': 'Gotovo',
  'autoImport.skip': 'Preskoči',

  // lightbox
  'lightbox.photoCount': '{current} / {total}',
  'lightbox.prev': 'Prethodna',
  'lightbox.next': 'Sljedeća',
  'lightbox.close': 'Zatvori',
};

const en: Translations = {
  // navigation
  'nav.collection': 'Collection',
  'nav.map': 'Map',
  'nav.species': 'Species',
  'nav.browse': 'Browse',
  'nav.stats': 'Stats',
  'nav.settings': 'Settings',

  // collection tab
  'collection.empty.heading': 'Your collection is empty',
  'collection.empty.body': 'Import your first mushroom find to get started.',
  'collection.loading': 'Loading finds…',
  'collection.importBtn': 'Import Photos',
  'collection.finds.one': 'find',
  'collection.finds.few': 'finds',
  'collection.finds.many': 'finds',
  'collection.folderNotes': 'Notes about {name}…',
  'collection.imported': 'Imported {n}',
  'collection.skipped': ' · Skipped {n}',
  'collection.deletedToast': 'Deleted {n}',
  'collection.movedToast': 'Moved {n} to {name}',
  'collection.selectFinds': 'Select',
  'collection.cancelSelect': 'Cancel',
  'collection.deleteSelected': 'Delete ({n})',
  'collection.moveToSpecies': 'Move to species…',
  'collection.moveTargetPlaceholder': 'Target species name',
  'collection.bulkMoveBtn': 'Move {n}',

  // import dialog
  'import.title': 'Import Photos',
  'import.pickPhotos': 'Pick Photos',
  'import.pickFolder': 'Pick Folder',
  'import.clearAll': 'Clear All',
  'import.mushroomName': 'Mushroom name',
  'import.pickLocation': 'Pick shared location',
  'import.newFolderHint': 'New folder will be created',
  'import.date': 'Date',
  'import.country': 'Country',
  'import.region': 'Region',
  'import.locationMark': 'Mark',
  'import.folderNotes': 'Folder notes…',
  'import.nameRequired': 'All photos must have a mushroom name before importing.',
  'import.importAll': 'Import All',

  // find preview card
  'preview.speciesName': 'Species name',
  'preview.dateRequired': 'Date required before import',
  'preview.country': 'Country',
  'preview.region': 'Region',
  'preview.locationMark': 'Mark',
  'preview.setLocation': 'Set location',
  'preview.notes': 'Notes',
  'preview.remove': 'Remove from list',
  'preview.deleteSource': 'Delete source file',
  'preview.deleteSourceHint': 'This will permanently move the source file to the Recycle Bin. Are you sure?',

  // find card
  'findCard.unnamed': '(unnamed)',
  'findCard.edit': 'Edit',

  // edit dialog
  'edit.title': 'Edit Find',
  'edit.species': 'Species',
  'edit.date': 'Date found',
  'edit.country': 'Country',
  'edit.region': 'Region',
  'edit.locationMark': 'Location mark',
  'edit.locationMarkPlaceholder': 'e.g. near the old oak',
  'edit.lat': 'Latitude',
  'edit.lng': 'Longitude',
  'edit.notes': 'Notes',
  'edit.cancel': 'Cancel',
  'edit.save': 'Save',
  'edit.saving': 'Saving…',

  // delete dialog
  'delete.title': 'Delete find?',
  'delete.recordOnly': 'Delete record only — keep photo file on disk',
  'delete.recordAndFiles': 'Delete record + files — move photo to Recycle Bin',
  'delete.moveFiles': 'Move files to another folder',
  'delete.chooseDestFolder': 'Choose destination folder',
  'delete.folderSelected': 'Folder selected ✓',
  'delete.moving': 'Moving…',
  'delete.cancel': 'Cancel',
  'delete.confirm': 'Delete',
  'delete.deleting': 'Deleting…',
  'delete.successRecord': 'Find deleted',
  'delete.successFiles': 'Find and files deleted',

  // settings dialog
  'settings.title': 'Settings',
  'settings.libraryLocation': 'Mushroom Library Location',
  'settings.notSet': '(not set)',
  'settings.changeFolder': 'Change Folder',
  'settings.choosing': 'Choosing…',
  'settings.changeFolderHint': 'Changing your library folder will ask whether to move or copy your existing data.',
  'settings.language': 'Language',
  'settings.langHr': 'Hrvatski',
  'settings.langEn': 'English',
  'settings.theme': 'Appearance',
  'settings.themeLight': 'Light',
  'settings.themeDark': 'Dark',
  'settings.resetSection': 'Reset App',
  'settings.resetBtn': 'Reset to First Run',
  'settings.resetTitle': 'Reset the app?',
  'settings.resetWarning': 'This will forget your library location and return you to the welcome screen. Your finds and photos on disk will NOT be deleted.',
  'settings.resetConfirm': 'Yes, reset',

  // first run dialog
  'firstRun.title': 'Choose Your Mushroom Library',
  'firstRun.description': 'Choose a folder where Bili Mushroom will store your finds, photos, and database. You can change this later in Settings.',
  'firstRun.noFolder': 'No folder selected',
  'firstRun.chooseFolder': 'Choose Folder',

  // auto-import dialog
  'autoImport.title.scanning': 'Scanning Library…',
  'autoImport.title.done': 'Import Complete',
  'autoImport.species': 'Importing: {name}',
  'autoImport.progress': '{current} / {total} species',
  'autoImport.result.species': '{n} species found',
  'autoImport.result.imported': '{n} photos imported',
  'autoImport.result.skipped': '{n} already existed, skipped',
  'autoImport.result.empty': 'No subfolders with photos found.',
  'autoImport.done': 'Done',
  'autoImport.skip': 'Skip',

  // lightbox
  'lightbox.photoCount': '{current} / {total}',
  'lightbox.prev': 'Previous',
  'lightbox.next': 'Next',
  'lightbox.close': 'Close',
};

const dict: Record<Lang, Translations> = { hr, en };

export function t(key: string, lang: Lang, vars?: Record<string, string | number>): string {
  let str = dict[lang][key] ?? dict['en'][key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(`{${k}}`, String(v));
    }
  }
  return str;
}

/** Returns translated find count string with Croatian-aware pluralization. */
export function tFindsCount(count: number, lang: Lang): string {
  if (lang === 'hr') {
    // Croatian: 1 → nalaz, 2-4 → nalaza, 5+ → nalaza
    const key = count === 1 ? 'collection.finds.one' : 'collection.finds.few';
    return `${count} ${t(key, lang)}`;
  }
  const key = count === 1 ? 'collection.finds.one' : 'collection.finds.many';
  return `${count} ${t(key, lang)}`;
}

/** React hook — returns a bound translator for the current language. */
export function useT() {
  const lang = useAppStore((s) => s.language);
  return (key: string, vars?: Record<string, string | number>) => t(key, lang, vars);
}
