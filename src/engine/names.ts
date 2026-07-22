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
    ],
    lastNames: [
      'Ashcombe', 'Barrowman', 'Cranfield', 'Denholm', 'Ellery', 'Fairbourne',
      'Grimshaw', 'Hollingworth', 'Ingram', 'Jessop', 'Kendrick', 'Lockhart',
      'Marchmont', 'Northcote', 'Oakley', 'Prescott', 'Quiller', 'Radcliffe',
      'Stanmore', 'Thackeray', 'Underhill', 'Vanbrough', 'Whitlock', 'Yardley',
      'Beckworth', 'Carrington', 'Dunmore', 'Everleigh', 'Fenwick', 'Halloway',
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
    ],
    lastNames: [
      'Almendral', 'Bermejo', 'Carrascal', 'Delgadillo', 'Escrivan', 'Fuentesol',
      'Garzon', 'Herrejon', 'Iriarte', 'Jarama', 'Lozano', 'Miravalles',
      'Narvaez', 'Olmedilla', 'Peralta', 'Quiroga', 'Requena', 'Salcedo',
      'Tordesillo', 'Urrutia', 'Valcarce', 'Ybarra', 'Zamorano', 'Bellido',
      'Cifuentes', 'Duran', 'Endrino', 'Ferreiro', 'Galvan', 'Hinojosa',
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
    ],
    lastNames: [
      'Baldracchi', 'Corvetti', 'Danesi', 'Ferrandino', 'Grimaldelli', 'Iacovone',
      'Lombardelli', 'Mazzanti', 'Nardone', 'Orsolini', 'Perrotta', 'Quaranta',
      'Rovelli', 'Scarpone', 'Tornatore', 'Ubaldini', 'Vercelli', 'Zaccagni',
      'Bellotti', 'Caruso', 'Dellavalle', 'Esposti', 'Fiorillo', 'Gattuzzo',
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
    ],
    lastNames: [
      'Aubertin', 'Belmondier', 'Chevrolier', 'Dauphine', 'Estival', 'Fourcade',
      'Guerlain', 'Hachette', 'Ivernel', 'Joubert', 'Lacaze', 'Marchandeau',
      'Noirval', 'Ouvrard', 'Pellerin', 'Quesnel', 'Roussillon', 'Sarrazin',
      'Trouvelot', 'Vaugrenard', 'Wattelier', 'Boisseau', 'Charmoy', 'Delaunay',
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
