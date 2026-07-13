-- Catalogue de départ (repris du prototype de design).
-- image_url est NULL : le front affiche alors le motif "wax" en attendant de vraies photos.

insert into public.products (name, category, price, colors, sizes, description, is_new) values
('Pagne Wax « Fleur de Gagnoa »', 'pagnes', 12000, '{Indigo,Ocre,Émeraude}', '{6 yards}', 'Wax hollandais 100% coton, motif floral éclatant. Idéal pour robes et ensembles de cérémonie.', true),
('Pagne Kita tissé main', 'pagnes', 24000, '{Or/Noir,Rouge/Or}', '{4 yards}', 'Tissage traditionnel à la main, fils dorés. Une pièce d''exception pour les grandes occasions.', true),
('Pagne Wax « Sable & Miel »', 'pagnes', 9500, '{Miel,Terre}', '{6 yards}', 'Coton doux aux tons chauds, parfait au quotidien comme en tenue.', false),
('Robe longue « Aïcha »', 'femmes', 42000, '{Indigo,Bordeaux}', '{S,M,L,XL,XXL}', 'Robe cintrée en wax premium, coupe fluide et col ajusté. Faite sur mesure à Treichville.', true),
('Ensemble jupe-top « Adjoa »', 'femmes', 38000, '{Émeraude,Ocre}', '{S,M,L,XL,XXL}', 'Top structuré et jupe portefeuille, entièrement doublés.', false),
('Boubou brodé « Reine »', 'femmes', 65000, '{Or,"Blanc cassé"}', '{S,M,L,XL,XXL}', 'Boubou grand teint avec broderie main au plastron. Élégance absolue.', true),
('Complet Boubou « Sékou »', 'hommes', 58000, '{Blanc,"Bleu nuit"}', '{S,M,L,XL,XXL}', 'Ensemble 3 pièces bazin riche, broderie discrète. Coupe ample et noble.', false),
('Chemise wax « Yao »', 'hommes', 22000, '{"Géométrique bleu",Ocre}', '{S,M,L,XL,XXL}', 'Chemise ajustée manches courtes en wax, boutons corozo.', true),
('Veste Kimono « Gagnoa »', 'hommes', 34000, '{Terre,Vert}', '{S,M,L,XL,XXL}', 'Veste légère mi-longue, doublée coton. Pour un style urbain affirmé.', false),
('Robe fillette « Petite Perle »', 'enfants', 15000, '{"Rose wax",Jaune}', '{"2-4 ans","4-6 ans","6-8 ans","8-10 ans"}', 'Robe à volants en wax doux, ceinture nouée dans le dos.', true),
('Ensemble garçon « Petit Prince »', 'enfants', 16500, '{Bleu,Vert}', '{"2-4 ans","4-6 ans","6-8 ans","8-10 ans"}', 'Chemisette et pantalon assortis en wax, confortables et solides.', false),
('Foulard wax « Éclat »', 'accessoires', 4500, '{Multicolore,Indigo}', '{Unique}', 'Foulard carré finition ourlée, mille et une façons de le porter.', false),
('Sac cabas en pagne', 'accessoires', 13500, '{Ocre,Émeraude}', '{Unique}', 'Cabas doublé, anses cuir végétal. Grande contenance.', true),
('Parure de bijoux « Akan »', 'accessoires', 18000, '{Doré}', '{Unique}', 'Collier et boucles inspirés de l''or Akan. Laiton doré à l''or fin.', false);
