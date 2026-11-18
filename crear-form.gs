/**
 * Crea el Google Form "Pronósticos VGA 2026" + su Google Sheet de respuestas,
 * y genera vga-config.json (en tu Drive) con los entry.XXXX que necesita la web.
 *
 * Uso: script.google.com → Nuevo proyecto → pegar este archivo → ejecutar crearFormulario
 *      → autorizar → ver el registro de ejecución.
 */

const TITULO = 'Pronósticos VGA 2026';

const CATEGORIAS = [
  { nombre: 'Game of the Year', nominados: ['007 First Light', 'Control Resonant', 'Grand Theft Auto 6', 'Phantom Blade Zero', 'Resident Evil Requiem', 'The Legend of Zelda: Ocarina of Time'] },
  { nombre: 'Best Game Direction', nominados: ['Control Resonant', 'Grand Theft Auto 6', 'Phantom Blade Zero', 'Pragmata', 'Resident Evil Requiem'] },
  { nombre: 'Best Narrative', nominados: ['007 First Light', 'Control Resonant', 'Grand Theft Auto 6', 'Resident Evil Requiem', 'The Blood of Dawnwalker'] },
  { nombre: 'Best Art Direction', nominados: ['Control Resonant', 'Grand Theft Auto 6', 'Mouse P.I. For Hire', 'Phantom Blade Zero', 'The Legend of Zelda: Ocarina of Time'] },
  { nombre: 'Best Score and Music', nominados: ['Ace Combat 8: Wings of Theve', 'Grand Theft Auto 6', 'Mixtape', 'Phantom Blade Zero', 'The Legend of Zelda: Ocarina of Time'] },
  { nombre: 'Best Audio Design', nominados: ['Ace Combat 8: Wings of Theve', 'Control Resonant', 'Grand Theft Auto 6', 'Resident Evil Requiem', 'Star Wars: Galactic Racer'] },
  { nombre: 'Best Performance', nominados: ['Patrick Gibson — 007 First Light', 'Angela Sant’Albano — Resident Evil Requiem', 'Liam McIntyre — Marvel’s Wolverine', 'Manni L. Perez — Grand Theft Auto 6', 'Rahul Kohli — Saros'] },
  { nombre: 'Games for Impact', nominados: ['Big Walk', 'Cairn', 'Forever Ago', 'Life is Strange Reunion', 'Lily’s World XD', 'Mixtape'] },
  { nombre: 'Best Ongoing Game', nominados: ['Arc Raiders', 'Final Fantasy 14 Online', 'Fortnite', 'No Man’s Sky', 'The Witcher 3: Wild Hunt'] },
  { nombre: 'Best Community Support', nominados: ['Crimson Desert', 'Helldivers 2', 'No Man’s Sky', 'The Witcher 3: Wild Hunt', 'Warframe'] },
  { nombre: 'Best Independent Game', nominados: ['Big Walk', 'Cairn', 'Denshattack', 'Mewgenics', 'Mina the Hollower'] },
  { nombre: 'Best Debut Indie Game', nominados: ['Dressmaker', 'Esoteric Ebb', 'Orbitals', 'Replaced', 'Silver Pines'] },
  { nombre: 'Best Mobile Game', nominados: ['Arknights Endfield', 'Monster Hunter Outlanders', 'Neverness to Everness', 'Pokemon Champions', 'Where Winds Meet'] },
  { nombre: 'Best VR/AR Game', nominados: ['Forefront', 'Into the Radious 2', 'Little Nightmares VR: Altered Echoes', 'Teenage Mutant Ninja Turtles: Empire City', 'Thief VR: Legacy of Shadow'] },
  { nombre: 'Best Action Game', nominados: ['Ace Combat 8: Wings of Theve', 'Gears of War: E-Day', 'Onimusha: Way of the Sword', 'Phantom Blade Zero', 'Saros'] },
  { nombre: 'Best Action/Adventure Game', nominados: ['007 First Light', 'Control Resonant', 'Grand Theft Auto 6', 'Pragmata', 'Resident Evil Requiem', 'The Legend of Zelda: Ocarina of Time'] },
  { nombre: 'Best Role-Playing Game', nominados: ['Final Fantasy Resonance', 'Fire Emblem: Fortune’s Weave', 'Monster Hunter Stories 3: Twisted Reflection', 'The Blood of Dawnwalker', 'Trails in the Sky: 2nd Chapter'] },
  { nombre: 'Best Fighting Game', nominados: ['2XKO', 'Avatar Legends: The Fighting Game', 'Invincible VS', 'Marvel Tokon: Fighting Souls', 'My Hero Academia: All’s Justice'] },
  { nombre: 'Best Family Game', nominados: ['Big Walk', 'Lego Batman: Legacy of the Dark Knight', 'Nintendo Switch Sports Resort', 'Pokemon Pokopia', 'Yoshi and the Mysterious Book'] },
  { nombre: 'Best Sim/Strategy Game', nominados: ['Mewgenics', 'Planet Zoo 2', 'Pokemon Pokopia', 'Slay the Spire 2', 'Star Wars Zero Company'] },
  { nombre: 'Best Sports/Racing Game', nominados: ['EA Sports FC 27', 'Forza Horizon 6', 'Nintendo Switch Sports Resort', 'Screamer', 'Star Wars: Galactic Racer'] },
  { nombre: 'Best Multiplayer Game', nominados: ['Big Walk', 'Call of Duty: Modern Warfare 4', 'Gears of War: E-Day', 'Marathon', 'Meccha Chameleon', 'Orbitals'] },
  { nombre: 'Best Adaptation', nominados: ['Cyberpunk Edgerunners: Season 2', 'Fallout: Season 2', 'Mortal Kombat 2', 'Resident Evil', 'The Super Mario Galaxy Movie'] },
  { nombre: 'Innovation in Accessibility', nominados: ['Assassin’s Creed: Black Flag Resynced', 'Forza Horizon 6', 'Gears of War: E-Day', 'Marvel’s Wolverine', 'Rhythm Heaven Groove'] },
  { nombre: 'Most Anticipated Game', nominados: ['Fable', 'Final Fantasy 7: Revelation', 'God of War Laufey', 'Resident Evil: Veronica', 'The Witcher 4'] },
  { nombre: 'Best Esports Game', nominados: ['Counter Strike 2', 'Dota 2', 'League of Legends', 'Mobile Legends: Bang Bang', 'Valorant'] },
];

function crearFormulario() {
  const form = FormApp.create(TITULO)
    .setDescription('Elegí quién creés que va a ganar en cada categoría.')
    .setCollectEmail(false)
    .setLimitOneResponsePerUser(false) // si fuera true exige login y rompe el envío desde la web
    .setAllowResponseEdits(false)
    .setProgressBar(true);
  try { form.setRequireLogin(false); } catch (e) { /* solo existe en cuentas Workspace */ }

  const alias = form.addTextItem().setTitle('Alias').setRequired(true);
  const items = CATEGORIAS.map(c =>
    form.addMultipleChoiceItem().setTitle(c.nombre).setChoiceValues(c.nominados).setRequired(false)
  );

  const sheet = SpreadsheetApp.create(TITULO + ' (respuestas)');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, sheet.getId());

  const config = {
    formAction: form.getPublishedUrl().replace(/\/viewform.*$/, '/formResponse'),
    aliasEntry: entryId_(form, alias.createResponse('x')),
    categorias: CATEGORIAS.map((c, i) => ({
      nombre: c.nombre,
      entry: entryId_(form, items[i].createResponse(c.nominados[0])),
      nominados: c.nominados,
    })),
  };

  const json = JSON.stringify(config, null, 2);
  const archivo = DriveApp.createFile('vga-config.json', json, MimeType.PLAIN_TEXT);

  Logger.log('Form (editar):    ' + form.getEditUrl());
  Logger.log('Form (público):   ' + form.getPublishedUrl());
  Logger.log('Sheet respuestas: ' + sheet.getUrl());
  Logger.log('Config JSON:      ' + archivo.getUrl());
  Logger.log(json);
}

/** Obtiene el número de entry.XXXX de una pregunta a partir de un link prellenado. */
function entryId_(form, itemResponse) {
  const url = form.createResponse().withItemResponse(itemResponse).toPrefilledUrl();
  const m = url.match(/entry\.(\d+)=/);
  if (!m) throw new Error('No se encontró entry en ' + url);
  return 'entry.' + m[1];
}
