"use strict";

/* Canonical names and biographies copied from MATR.Game/Engine/Model/Character.cs.
   Portraits remain in their original directory and are referenced, never duplicated. */
window.ROUNDHOUSE_CHARACTERS = [
  ["01","Lady Beatrice Henshaw","A refined widow and former London salon host, known for her sharp tongue, exquisite fashion, and a secretive past involving an Italian count."],
  ["02","Colonel Arthur Pembroke","A retired army officer with impeccable manners, a booming voice, and a revolver kept for old times’ sake."],
  ["03","Clara Vale","A glamorous London jazz singer whose charm and smoky voice conceal rumours that she is fleeing someone dangerous."],
  ["04","Dr. Reginald Quill","A thoughtful country doctor whose calm manner hides a deep knowledge of poisons—purely for medical purposes, of course."],
  ["05","Evelyn March","A young novelist devoted to mystery and romance, visiting the Roundhouse perhaps in search of her next bestseller."],
  ["06","Inspector Lionel Drake","A seasoned Scotland Yard detective fond of puzzles and pipe smoke, and never entirely off duty."],
  ["07","Giovanni Rossi","The charming Italian gardener, proud of the grounds but evasive whenever anyone asks about his past."],
  ["08","Margot Fairchild","A lively socialite with a dazzling laugh, a taste for scandal, and more knowledge of the household than she admits."],
  ["09","Reverend Thomas Bellamy","A kind but nervous clergyman on a quiet retreat, troubled by something deeper than spiritual doubt."],
  ["10","Peter Henshaw","Lady Beatrice’s charming, reckless son, heir to both her taste for luxury and her penchant for secrets."],
  ["11","Mrs. Agatha Brown","The Roundhouse’s loyal, practical housekeeper; always listening and unmatched in her knowledge of the house."],
  ["12","Felix D’Arcy","A dashing art dealer returned from Italy with mysterious sculptures, dangerous ambition, and perhaps a stolen masterpiece."],
  ["13","Mr. Ling","A composed silk merchant from Shanghai on private business, carrying a locked travelling case he refuses to open."],
  ["14","Camille Beaumont","A sharp-witted Parisian journalist writing about English country houses—never without an ulterior motive."],
  ["15","Theodore Crane","A reserved antiquarian with encyclopaedic knowledge of poisons, traps, and torture devices—purely academic, he insists."],
  ["16","Princess Meherbano","A gracious but steely princess from Hyderabad, travelling incognito with a supposedly cursed emerald ring."],
  ["17","Moira O'Connell","An Irish stage illusionist with nimble hands, a velvet laugh, and a belief that every secret has a trapdoor."],
  ["18","Otto Meier","A meticulous German watchmaker who notices every tick, every pause, and every guest who claims to have been elsewhere."]
].map(([id, name, profile]) => ({
  id, name, profile, image: `assets/portraits/${id}.png`
}));
