/**
 * Fiktive Namenspools (Konzept Abschnitt 5).
 * Bewusst erfunden, damit keine echten Vereine oder Personen verwendet werden.
 */

export interface NamePool {
  firstNames: string[];
  lastNames: string[];
  cities: string[];
  clubPrefixes: string[];
  clubSuffixes: string[];
  managerFirst: string[];
}

export const NAME_POOLS: Record<string, NamePool> = {
  falkenland: {
    firstNames: [
      'Jonas', 'Nico', 'Lennard', 'Fabian', 'Tobias', 'Marek', 'Silas', 'Kilian',
      'Arne', 'Ruben', 'Malte', 'Jannis', 'Till', 'Bennet', 'Hendrik', 'Levin',
      'Moritz', 'Anton', 'Ole', 'Elias', 'Emil', 'Fynn', 'Joris', 'Marlon',
      'Nils', 'Piet', 'Quirin', 'Sven', 'Thore', 'Valentin', 'Aaron', 'Bastian',
      'Cedric', 'Damian', 'Erik', 'Florian', 'Gero', 'Hauke', 'Ilja', 'Jakob',
      'Konrad', 'Lasse', 'Mattis', 'Norik', 'Oskar', 'Paul', 'Rasmus', 'Simon',
      'Adrian', 'Bjarne', 'Carlo', 'Dennis', 'Eike', 'Falk',
      'Gunnar', 'Henrik', 'Ingo', 'Jost', 'Kai', 'Leif',
      'Merlin', 'Nikolas', 'Ove', 'Philemon', 'Ragnar', 'Sebastian',
      'Timo', 'Uwe', 'Veit', 'Wilko', 'Yannik', 'Arved',
      'Bosse', 'Claas', 'Detlev', 'Enno', 'Frerk', 'Gustav',
    ],
    lastNames: [
      'Ahrenberg', 'Brenneke', 'Dornbusch', 'Eichhorst', 'Fischbach', 'Grunewald',
      'Habicht', 'Immhoff', 'Jansen', 'Kaltenbach', 'Lehnhardt', 'Moorbach',
      'Neuhaus', 'Ostermann', 'Pfeilstein', 'Quandt', 'Reitmeier', 'Sturmberg',
      'Tannhoff', 'Uhlig', 'Vetterlein', 'Waldschmidt', 'Zeidler', 'Bergmann',
      'Krauss', 'Wendland', 'Osterloh', 'Nordmann', 'Reichl', 'Schoenfeld',
      'Falkner', 'Hartmann', 'Steinbach', 'Wieland', 'Reinhardt', 'Kohlmann',
      'Baumgart', 'Lindner', 'Grothe', 'Vogelsang', 'Ebert', 'Sandberg',
      'Kastner', 'Meinhardt', 'Rothbauer', 'Wintersen', 'Duerrhoff', 'Espenlaub',
      'Gerlach', 'Holtmann', 'Isenbeck', 'Kerner', 'Lauterbach', 'Muehlberg',
      'Nagelschmidt', 'Oberweis', 'Petersen', 'Rammelsberg', 'Seewald', 'Trautner',
      'Amsel', 'Birkholz', 'Cordes', 'Drewes', 'Eggersglues', 'Falkenrath',
      'Hoevelmann', 'Isernhagen', 'Jaspers', 'Kienbaum', 'Lohmeyer', 'Marquardt',
      'Niebuhr', 'Oldenburg', 'Pflueger', 'Quirin', 'Rothaug', 'Siebenhaar',
      'Trittau', 'Ummen', 'Voigtlaender', 'Wattenscheid', 'Zieseniss', 'Ahlgrimm',
      'Brockhaus', 'Duennebier', 'Ellerbrock', 'Fassbender', 'Grothues', 'Hillebrand',
      'Kettenbach', 'Luetkemeyer', 'Mohrbach', 'Nienkaemper', 'Pralle', 'Reddemann',
      'Suedkamp', 'Thelen', 'Wolterding',
      // Ein paar schrullige darunter - selten genug, dass sie auffallen.
      'Zwiebelmann', 'Federleicht', 'Sonntagskind', 'Klingelhoefer',
      'Nebelschick', 'Wunderlich', 'Sausewind', 'Krautgartner',
      'Morgenroth', 'Pusteblume', 'Donnerhack', 'Kuchenbecker',
    ],
    cities: [
      'Nordheim', 'Adlerstadt', 'Rotenburg', 'Bergwald', 'Falkensee', 'Steinfurt',
      'Hohental', 'Weissbrunn', 'Eichenau', 'Sturmberg', 'Moorbach', 'Lindental',
      'Kaltenau', 'Grauenfels', 'Tannbruck', 'Silberbach', 'Wolfstein', 'Ravensfeld',
      'Ellerbach', 'Hafenau', 'Dornstadt', 'Kranichberg', 'Marbeck', 'Ossenfurt',
      'Pirkheim', 'Quellenau', 'Rehbrunn', 'Sonnenfels', 'Tiefental', 'Ulrichshain',
      'Vogelsbach', 'Wehrhagen', 'Zellerbrunn', 'Ammersfeld', 'Blankenau', 'Cranzberg',
      'Duernstein', 'Erlenkamp', 'Freiberg', 'Grimmental', 'Hollerbach', 'Innau',
      'Jagsthausen', 'Klingenau', 'Lauterfeld', 'Muehlenstadt', 'Neuwiese', 'Oberrain',
      'Perlbach', 'Rauental', 'Schwarzenau', 'Talheim', 'Uttenhain', 'Vierbrunn',
      'Wildbach', 'Zwieselau', 'Aschenfeld', 'Bruckstadt', 'Cornau', 'Dahlenberg',
    ],
    clubPrefixes: ['FC', 'SV', 'SC', 'VfB', 'TSV', 'VfL', 'SpVgg', 'FSV', 'BSC', 'TuS', '1. FC', 'SG'],
    clubSuffixes: ['', '', '', '', '08', '04', '1911', '96', 'United'],
    managerFirst: ['Gunnar', 'Detlev', 'Reiner', 'Ulf', 'Wolfram', 'Heiko', 'Bernd', 'Klaas'],
  },

  albion: {
    firstNames: [
      'Callum', 'Reece', 'Nathan', 'Owen', 'Declan', 'Jaden', 'Marcus', 'Harvey',
      'Corey', 'Elliot', 'Finley', 'Grayson', 'Hugo', 'Isaac', 'Jarrod', 'Kyle',
      'Liam', 'Mason', 'Noah', 'Oscar', 'Preston', 'Quinn', 'Rory', 'Spencer',
      'Toby', 'Vince', 'Wesley', 'Zach', 'Adam', 'Brandon', 'Cody', 'Dexter',
      'Alfie', 'Bradley', 'Gareth', 'Jamie', 'Kieran', 'Lewis',
      'Vincent', 'Zachary', 'Archie', 'Bailey', 'Casey', 'Dominic',
      'Edward', 'Frankie', 'Grant', 'Hugh', 'Ivor', 'Jude',
      'Kai', 'Louie', 'Miles', 'Noel', 'Ollie',
    ],
    lastNames: [
      'Ashcombe', 'Barrowman', 'Cranfield', 'Denholm', 'Ellery', 'Fairbourne',
      'Grimshaw', 'Hollingworth', 'Ingram', 'Jessop', 'Kendrick', 'Lockhart',
      'Marchmont', 'Northcote', 'Oakley', 'Prescott', 'Quiller', 'Radcliffe',
      'Stanmore', 'Thackeray', 'Underhill', 'Vanbrough', 'Whitlock', 'Yardley',
      'Beckworth', 'Carrington', 'Dunmore', 'Everleigh', 'Fenwick', 'Halloway',
      'Ackroyd', 'Barlowe', 'Eastwick', 'Fairbrass', 'Ingleby', 'Jardine',
      'Kenworthy', 'Loxley', 'Marchbank', 'Netherwood', 'Ormerod', 'Pemberley',
      'Quarrier', 'Ravensworth', 'Stanbury', 'Thirlwall', 'Vosper', 'Whitcombe',
      'Ashfield', 'Brackenbury', 'Culverhouse', 'Denby', 'Ellingham', 'Fothergill',
      'Garrowby', 'Hawksworth', 'Illingworth', 'Kettlewell', 'Lampeter', 'Mowbray',
      'Norbury', 'Pickersgill', 'Rusholme', 'Swaithe', 'Tarleton', 'Wexford',
      'Yeardley', 'Bramhall', 'Crossley', 'Dearnley', 'Gaunt', 'Holbeck',
      'Kirkbride', 'Linthwaite', 'Middlebrook', 'Osgathorpe', 'Prestwich', 'Rowntree',
      'Sedgwick', 'Threlfall', 'Wolstenholme', 'Yeadon', 'Balderstone',
      // Ein paar schrullige darunter - selten genug, dass sie auffallen.
      'Widdicombe', 'Bumblethorpe', 'Pennyfeather', 'Quickfall',
      'Ramsbottom', 'Sillitoe', 'Twizzle', 'Wagstaff',
      'Bagshaw', 'Clutterbuck', 'Drinkwater', 'Fiddleton',
    ],
    cities: [
      'Kingsmoor', 'Ashford', 'Northbridge', 'Redcliff', 'Whitmore', 'Ironvale',
      'Harborne', 'Blackwell', 'Stonebury', 'Eastgate', 'Grimsby Vale', 'Loxbridge',
      'Westhaven', 'Thornwick', 'Colbourne', 'Marsden', 'Pendleton', 'Ravenshaw',
    ],
    clubPrefixes: ['', '', '', '', 'FC'],
    clubSuffixes: ['United', 'City', 'Rovers', 'Town', 'Athletic', 'Wanderers', 'Albion', 'County', 'FC', 'Forest'],
    managerFirst: ['Neville', 'Roy', 'Graham', 'Terry', 'Alan', 'Duncan'],
  },

  iberia: {
    firstNames: [
      'Alvaro', 'Bruno', 'Cesar', 'Diego', 'Enzo', 'Fermin', 'Gonzalo', 'Hector',
      'Ivan', 'Joaquin', 'Lucas', 'Mateo', 'Nacho', 'Oriol', 'Pablo', 'Quim',
      'Rafa', 'Sergio', 'Tomas', 'Unai', 'Vicente', 'Xabi', 'Yago', 'Adrian',
      'Borja', 'Carlos', 'Dani', 'Emilio', 'Fabio', 'Guillem',
      'Cristobal', 'Fernando', 'Ignacio', 'Manuel', 'Nicolas', 'Oscar',
      'Rodrigo', 'Xavier', 'Dario', 'Eduardo', 'Felipe', 'Gabriel',
      'Hugo', 'Ismael', 'Javier', 'Leandro', 'Marcos', 'Nuno',
      'Octavio', 'Ruben', 'Salvador', 'Teodoro', 'Ulises', 'Vasco',
    ],
    lastNames: [
      'Almendral', 'Bermejo', 'Carrascal', 'Delgadillo', 'Escrivan', 'Fuentesol',
      'Garzon', 'Herrejon', 'Iriarte', 'Jarama', 'Lozano', 'Miravalles',
      'Narvaez', 'Olmedilla', 'Peralta', 'Quiroga', 'Requena', 'Salcedo',
      'Tordesillo', 'Urrutia', 'Valcarce', 'Ybarra', 'Zamorano', 'Bellido',
      'Cifuentes', 'Duran', 'Endrino', 'Ferreiro', 'Galvan', 'Hinojosa',
      'Abascal', 'Carranza', 'Escalante', 'Fontanals', 'Guijarro', 'Higueras',
      'Izaguirre', 'Jaramillo', 'Lastra', 'Madrazo', 'Nogueira', 'Olivares',
      'Pardal', 'Redondela', 'Tarazona', 'Ubierna', 'Valdivielso', 'Zubiria',
      'Alcantara', 'Benavides', 'Casanueva', 'Domingues', 'Estevez', 'Frontela',
      'Gorostiza', 'Herrezuelo', 'Larrazabal', 'Mendizabal', 'Narbona', 'Ochandiano',
      'Peralejo', 'Quintanar', 'Requejo', 'Sotomayor', 'Trapero', 'Uriondo',
      'Villaverde', 'Zaldivar', 'Amezaga', 'Bustinza', 'Corcuera', 'Elorriaga',
      'Garaikoetxea', 'Landaluce', 'Olabarria', 'Pagoaga', 'Retegui', 'Sarasola',
      'Txurruka', 'Zabaleta', 'Barrenetxea', 'Etxeberria',
      // Ein paar schrullige darunter - selten genug, dass sie auffallen.
      'Cascabel', 'Malapata', 'Pimentel', 'Rebolledo',
      'Tortolero', 'Vinagre', 'Caramelo', 'Zapatero',
      'Buenaventura', 'Cascarilla', 'Peluchez', 'Tarambana',
    ],
    cities: [
      'Valmera', 'Castilbao', 'Riosanto', 'Montverde', 'Puertola', 'Alcazara',
      'Sierrablanca', 'Navalcruz', 'Torrenova', 'Ribadelmar', 'Espinar', 'Lagunilla',
    ],
    clubPrefixes: ['CD', 'CF', 'SD', 'UD', 'Atletico', 'Sporting', 'Deportivo', 'Real'],
    clubSuffixes: ['', '', '', 'FC'],
    managerFirst: ['Ramon', 'Julen', 'Paco', 'Ernesto', 'Luis'],
  },

  calcio: {
    firstNames: [
      'Alessio', 'Bruno', 'Cristian', 'Davide', 'Emanuele', 'Fabrizio', 'Gianluca',
      'Ivano', 'Lorenzo', 'Matteo', 'Nicolo', 'Ottavio', 'Pietro', 'Riccardo',
      'Simone', 'Tommaso', 'Umberto', 'Valerio', 'Andrea', 'Federico', 'Giacomo',
      'Leonardo', 'Marco', 'Stefano',
      'Alberto', 'Bernardo', 'Cesare', 'Dario', 'Enrico', 'Filippo',
      'Giorgio', 'Ignazio', 'Luca', 'Massimo', 'Nicola', 'Orlando',
      'Paolo', 'Raffaele', 'Salvatore', 'Tiziano', 'Ubaldo', 'Vittorio',
      'Antonio', 'Domenico', 'Elia', 'Fausto', 'Gabriele', 'Ilario',
      'Lodovico', 'Michele', 'Nunzio', 'Oreste', 'Pasquale', 'Renzo',
      'Sergio', 'Teodoro', 'Vincenzo', 'Amedeo', 'Bartolomeo', 'Carmine',
      'Dante', 'Ettore', 'Flavio', 'Giulio', 'Lamberto', 'Mauro',
      'Nino', 'Ottone', 'Pierluigi', 'Rocco',
    ],
    lastNames: [
      'Baldracchi', 'Corvetti', 'Danesi', 'Ferrandino', 'Grimaldelli', 'Iacovone',
      'Lombardelli', 'Mazzanti', 'Nardone', 'Orsolini', 'Perrotta', 'Quaranta',
      'Rovelli', 'Scarpone', 'Tornatore', 'Ubaldini', 'Vercelli', 'Zaccagni',
      'Bellotti', 'Caruso', 'Dellavalle', 'Esposti', 'Fiorillo', 'Gattuzzo',
      'Amoruso', 'Bertolazzi', 'Cannavaro', 'Diamanti', 'Evangelisti', 'Fioravanti',
      'Guccione', 'Imbriani', 'Lanzafame', 'Montervino', 'Nocerino', 'Occhipinti',
      'Pandolfini', 'Quagliarulo', 'Ravanelli', 'Sabatini', 'Tavecchio', 'Ubertini',
      'Valentini', 'Zamparini', 'Battistoni', 'Cerruti', 'Donadoni', 'Empoli',
      'Ferrarese', 'Giannotti', 'Iachini', 'Lucarelli', 'Malagoli', 'Nicolosi',
      'Ottaviani', 'Petrucci', 'Rambaudi', 'Sartori', 'Tremonti', 'Vanoli',
      'Zampini', 'Bagnoli', 'Calzoni', 'Dossena', 'Fabbrini', 'Ghirardi',
      'Loparco', 'Marchetti', 'Nastasi', 'Pizzaballa', 'Riolfo', 'Sgarbossa',
      'Toldini', 'Vialli', 'Zenoni', 'Arcuri', 'Brunelli', 'Cordoba',
      'Dellacasa', 'Fanucci', 'Guidolin', 'Lupatelli', 'Moriero', 'Paganini',
      'Ruggiero', 'Serena', 'Tacchinardi', 'Vergassola', 'Zauri', 'Bonaventura',
      // Ein paar schrullige darunter - selten genug, dass sie auffallen.
      'Frittella', 'Papavero', 'Scarpetta', 'Trombetta',
      'Zuccherini', 'Mozzarelli', 'Confetti', 'Rondinella',
      'Spaghetto', 'Verdolino', 'Tacchetti', 'Girandola',
    ],
    cities: [
      'Montaldo', 'Verrano', 'Portosano', 'Castelmare', 'Lucanera', 'Aventino',
      'Ronciglio', 'Salvatera', 'Belforte', 'Cimalta', 'Doriano', 'Fossanuova',
    ],
    clubPrefixes: ['AC', 'US', 'FC', 'Calcio', 'AS', 'SS'],
    clubSuffixes: ['', '', '', '1909', 'Calcio'],
    managerFirst: ['Massimo', 'Claudio', 'Gianpiero', 'Sandro', 'Fulvio'],
  },

  gallia: {
    firstNames: [
      'Antoine', 'Baptiste', 'Cedric', 'Dimitri', 'Etienne', 'Florian', 'Guillaume',
      'Hugo', 'Julien', 'Kevin', 'Ludovic', 'Mathis', 'Noel', 'Olivier', 'Pierre',
      'Quentin', 'Remy', 'Sebastien', 'Thibault', 'Ulysse', 'Vincent', 'Yannick',
      'Adrien', 'Bastien', 'Clement', 'Damien',
      'Alexandre', 'Benoit', 'Christophe', 'Didier', 'Emile', 'Fabrice',
      'Gaetan', 'Hubert', 'Ivan', 'Jerome', 'Laurent', 'Maxime',
      'Nicolas', 'Octave', 'Pascal', 'Raphael', 'Stephane', 'Theo',
      'Valentin', 'Xavier', 'Yann', 'Arnaud', 'Bertrand', 'Corentin',
      'Denis', 'Edouard', 'Franck', 'Gilles', 'Hervi', 'Ismael',
      'Joachim', 'Lucien', 'Marius', 'Nolan', 'Odilon', 'Patrice',
      'Romain', 'Sylvain', 'Tristan', 'Ugo', 'Victor', 'Aurelien',
      'Cyprien', 'Dorian',
    ],
    lastNames: [
      'Aubertin', 'Belmondier', 'Chevrolier', 'Dauphine', 'Estival', 'Fourcade',
      'Guerlain', 'Hachette', 'Ivernel', 'Joubert', 'Lacaze', 'Marchandeau',
      'Noirval', 'Ouvrard', 'Pellerin', 'Quesnel', 'Roussillon', 'Sarrazin',
      'Trouvelot', 'Vaugrenard', 'Wattelier', 'Boisseau', 'Charmoy', 'Delaunay',
      'Anquetil', 'Bellanger', 'Chevrolet', 'Escoffier', 'Fontenelle', 'Gaudreau',
      'Hautecoeur', 'Isambert', 'Jouvenel', 'Lachapelle', 'Marchand', 'Noirot',
      'Ollivier', 'Peyrefitte', 'Rocheteau', 'Sauvageot', 'Thevenin', 'Urbain',
      'Valcourt', 'Wavrin', 'Ybert', 'Cazenave', 'Duchemin', 'Espinasse',
      'Grandmaison', 'Hennequin', 'Jaubert', 'Lassalle', 'Monnereau', 'Nogaret',
      'Osselin', 'Pouliquen', 'Ramoneda', 'Sabourin', 'Tanguy', 'Vauquelin',
      'Amouroux', 'Barrault', 'Chastaing', 'Delcourt', 'Fauveau', 'Gimenez',
      'Huchet', 'Jomard', 'Lebreton', 'Maufroy', 'Nourrigat', 'Pellissier',
      'Reynaud', 'Soubeyran', 'Trintignant', 'Vaillancourt', 'Boulanger', 'Charbonneau',
      'Desmarais', 'Fournival', 'Guilbert', 'Lavigne', 'Mercier', 'Perrault',
      'Roussel',
      // Ein paar schrullige darunter - selten genug, dass sie auffallen.
      'Croquemitaine', 'Pamplemousse', 'Boulanger-Dupont', 'Chapeaurouge',
      'Trompette', 'Vinaigrier', 'Gribouille', 'Pomponnet',
      'Ratatouille', 'Soufflard', 'Ficelle', 'Cabriole',
    ],
    cities: [
      'Beaumont', 'Valcourt', 'Roquefer', 'Montclair', 'Saint-Aubin', 'Lisieres',
      'Chantonne', 'Fontenoy', 'Grandvaux', 'Hauteclair', 'Merigny', 'Pontarlie',
    ],
    clubPrefixes: ['AS', 'FC', 'Olympique', 'Racing', 'Stade', 'US'],
    clubSuffixes: ['', '', '', 'FC'],
    managerFirst: ['Gerard', 'Michel', 'Laurent', 'Pascal', 'Herve'],
  },
};

export const STADIUM_WORDS = [
  'Arena', 'Stadion', 'Park', 'Sportpark', 'Kampfbahn', 'Waldstadion', 'Stadion am Ring',
];

/** Orte, nach denen traditionsreiche Stadien benannt sind ("Stadion an der ..."). */
export const STADIUM_PLACES = [
  'Bergstrasse', 'Alten Foersterei', 'Hafenmole', 'Muehlenaue', 'Kastanienallee',
  'Alten Ziegelei', 'Talbruecke', 'Weinsteige', 'Nordkurve', 'Schleuse',
];

/** Eigenstaendige Stadionnamen ohne Stadtbezug. */
export const STADIUM_STANDALONE = [
  'Waldstadion', 'Stadion am Hohen Wall', 'Gruenwaldstadion', 'Sportpark Suedhang',
  'Rheinauepark', 'Stadion Rote Erde', 'Weserkampfbahn', 'Stadion Alte Foersterei',
];
