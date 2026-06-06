-- Jogos da Copa do Mundo 2026 — Fase de Grupos
-- Fonte: Sorteio FIFA dezembro 2024
-- Datas em UTC-3 (horário de Brasília)

-- GRUPO A
insert into games (phase, group_name, game_number, home_team, away_team, home_flag, away_flag, game_date, venue) values
('group','A',1,'México','Senegal','🇲🇽','🇸🇳','2026-06-11 18:00:00-03','Azteca, Cidade do México'),
('group','A',2,'Estados Unidos','Eslovênia','🇺🇸','🇸🇮','2026-06-12 18:00:00-03','MetLife, Nova York'),
('group','A',3,'Estados Unidos','Senegal','🇺🇸','🇸🇳','2026-06-16 15:00:00-03','SoFi, Los Angeles'),
('group','A',4,'México','Eslovênia','🇲🇽','🇸🇮','2026-06-16 21:00:00-03','Azteca, Cidade do México'),
('group','A',5,'Senegal','Eslovênia','🇸🇳','🇸🇮','2026-06-20 17:00:00-03','Gillette, Boston'),
('group','A',6,'México','Estados Unidos','🇲🇽','🇺🇸','2026-06-20 17:00:00-03','Azteca, Cidade do México');

-- GRUPO B
insert into games (phase, group_name, game_number, home_team, away_team, home_flag, away_flag, game_date, venue) values
('group','B',7,'Argentina','Líbano','🇦🇷','🇱🇧','2026-06-13 15:00:00-03','Metlife, Nova York'),
('group','B',8,'Austrália','Marrocos','🇦🇺','🇲🇦','2026-06-13 18:00:00-03','SoFi, Los Angeles'),
('group','B',9,'Argentina','Austrália','🇦🇷','🇦🇺','2026-06-17 15:00:00-03','Hard Rock, Miami'),
('group','B',10,'Marrocos','Líbano','🇲🇦','🇱🇧','2026-06-17 18:00:00-03','Gillette, Boston'),
('group','B',11,'Líbano','Austrália','🇱🇧','🇦🇺','2026-06-21 17:00:00-03','Lumen Field, Seattle'),
('group','B',12,'Argentina','Marrocos','🇦🇷','🇲🇦','2026-06-21 17:00:00-03','Metlife, Nova York');

-- GRUPO C
insert into games (phase, group_name, game_number, home_team, away_team, home_flag, away_flag, game_date, venue) values
('group','C',13,'Brasil','Croácia','🇧🇷','🇭🇷','2026-06-13 21:00:00-03','AT&T, Dallas'),
('group','C',14,'Alemanha','Japão','🇩🇪','🇯🇵','2026-06-14 15:00:00-03','Levi''s, San Francisco'),
('group','C',15,'Brasil','Japão','🇧🇷','🇯🇵','2026-06-18 18:00:00-03','Rose Bowl, Los Angeles'),
('group','C',16,'Croácia','Alemanha','🇭🇷','🇩🇪','2026-06-18 21:00:00-03','Arrowhead, Kansas City'),
('group','C',17,'Japão','Croácia','🇯🇵','🇭🇷','2026-06-22 17:00:00-03','Allegiant, Las Vegas'),
('group','C',18,'Brasil','Alemanha','🇧🇷','🇩🇪','2026-06-22 17:00:00-03','AT&T, Dallas');

-- GRUPO D
insert into games (phase, group_name, game_number, home_team, away_team, home_flag, away_flag, game_date, venue) values
('group','D',19,'França','Argélia','🇫🇷','🇩🇿','2026-06-14 18:00:00-03','Mercedes-Benz, Atlanta'),
('group','D',20,'Portugal','Bulgária','🇵🇹','🇧🇬','2026-06-14 21:00:00-03','Lincoln, Filadélfia'),
('group','D',21,'França','Bulgária','🇫🇷','🇧🇬','2026-06-18 15:00:00-03','Hard Rock, Miami'),
('group','D',22,'Portugal','Argélia','🇵🇹','🇩🇿','2026-06-19 21:00:00-03','Rose Bowl, Los Angeles'),
('group','D',23,'Argélia','Bulgária','🇩🇿','🇧🇬','2026-06-23 17:00:00-03','Arrowhead, Kansas City'),
('group','D',24,'França','Portugal','🇫🇷','🇵🇹','2026-06-23 17:00:00-03','MetLife, Nova York');

-- GRUPO E
insert into games (phase, group_name, game_number, home_team, away_team, home_flag, away_flag, game_date, venue) values
('group','E',25,'Espanha','Tunísia','🇪🇸','🇹🇳','2026-06-14 12:00:00-03','BC Place, Vancouver'),
('group','E',26,'Holanda','Noruega','🇳🇱','🇳🇴','2026-06-15 15:00:00-03','Lumen Field, Seattle'),
('group','E',27,'Espanha','Noruega','🇪🇸','🇳🇴','2026-06-19 12:00:00-03','BC Place, Vancouver'),
('group','E',28,'Holanda','Tunísia','🇳🇱','🇹🇳','2026-06-19 18:00:00-03','Levi''s, San Francisco'),
('group','E',29,'Tunísia','Noruega','🇹🇳','🇳🇴','2026-06-23 17:00:00-03','Estadio Akron, Guadalajara'),
('group','E',30,'Espanha','Holanda','🇪🇸','🇳🇱','2026-06-23 17:00:00-03','Lincoln, Filadélfia');

-- GRUPO F
insert into games (phase, group_name, game_number, home_team, away_team, home_flag, away_flag, game_date, venue) values
('group','F',31,'Uruguai','Cazaquistão','🇺🇾','🇰🇿','2026-06-15 12:00:00-03','Mercedes-Benz, Atlanta'),
('group','F',32,'Inglaterra','Turcomenistão','🏴󠁧󠁢󠁥󠁮󠁧󠁿','🇹🇲','2026-06-15 21:00:00-03','Gillette, Boston'),
('group','F',33,'Uruguai','Turcomenistão','🇺🇾','🇹🇲','2026-06-19 15:00:00-03','Hard Rock, Miami'),
('group','F',34,'Inglaterra','Cazaquistão','🏴󠁧󠁢󠁥󠁮󠁧󠁿','🇰🇿','2026-06-20 12:00:00-03','Lincoln, Filadélfia'),
('group','F',35,'Cazaquistão','Turcomenistão','🇰🇿','🇹🇲','2026-06-24 17:00:00-03','Allegiant, Las Vegas'),
('group','F',36,'Uruguai','Inglaterra','🇺🇾','🏴󠁧󠁢󠁥󠁮󠁧󠁿','2026-06-24 17:00:00-03','SoFi, Los Angeles');

-- GRUPO G
insert into games (phase, group_name, game_number, home_team, away_team, home_flag, away_flag, game_date, venue) values
('group','G',37,'Bélgica','Sudão do Sul','🇧🇪','🇸🇸','2026-06-15 18:00:00-03','AT&T, Dallas'),
('group','G',38,'Itália','Suíça','🇮🇹','🇨🇭','2026-06-16 12:00:00-03','Allegiant, Las Vegas'),
('group','G',39,'Bélgica','Suíça','🇧🇪','🇨🇭','2026-06-20 15:00:00-03','Arrowhead, Kansas City'),
('group','G',40,'Itália','Sudão do Sul','🇮🇹','🇸🇸','2026-06-20 18:00:00-03','Rose Bowl, Los Angeles'),
('group','G',41,'Sudão do Sul','Suíça','🇸🇸','🇨🇭','2026-06-24 17:00:00-03','Estadio BBVA, Monterrey'),
('group','G',42,'Bélgica','Itália','🇧🇪','🇮🇹','2026-06-24 17:00:00-03','AT&T, Dallas');

-- GRUPO H
insert into games (phase, group_name, game_number, home_team, away_team, home_flag, away_flag, game_date, venue) values
('group','H',43,'Colômbia','Iêmen','🇨🇴','🇾🇪','2026-06-16 15:00:00-03','Estadio BBVA, Monterrey'),
('group','H',44,'Coreia do Sul','Camarões','🇰🇷','🇨🇲','2026-06-16 18:00:00-03','Estadio Akron, Guadalajara'),
('group','H',45,'Colômbia','Camarões','🇨🇴','🇨🇲','2026-06-20 12:00:00-03','Estadio BBVA, Monterrey'),
('group','H',46,'Coreia do Sul','Iêmen','🇰🇷','🇾🇪','2026-06-21 12:00:00-03','Estadio Akron, Guadalajara'),
('group','H',47,'Iêmen','Camarões','🇾🇪','🇨🇲','2026-06-25 17:00:00-03','Lumen Field, Seattle'),
('group','H',48,'Colômbia','Coreia do Sul','🇨🇴','🇰🇷','2026-06-25 17:00:00-03','SoFi, Los Angeles');

-- GRUPO I
insert into games (phase, group_name, game_number, home_team, away_team, home_flag, away_flag, game_date, venue) values
('group','I',49,'Dinamarca','Sérvia','🇩🇰','🇷🇸','2026-06-17 12:00:00-03','Levi''s, San Francisco'),
('group','I',50,'Nova Zelândia','Arábia Saudita','🇳🇿','🇸🇦','2026-06-17 21:00:00-03','Arrowhead, Kansas City'),
('group','I',51,'Dinamarca','Arábia Saudita','🇩🇰','🇸🇦','2026-06-21 18:00:00-03','Allegiant, Las Vegas'),
('group','I',52,'Nova Zelândia','Sérvia','🇳🇿','🇷🇸','2026-06-21 21:00:00-03','Lincoln, Filadélfia'),
('group','I',53,'Sérvia','Arábia Saudita','🇷🇸','🇸🇦','2026-06-25 17:00:00-03','Mercedes-Benz, Atlanta'),
('group','I',54,'Dinamarca','Nova Zelândia','🇩🇰','🇳🇿','2026-06-25 17:00:00-03','Gillette, Boston');

-- GRUPO J
insert into games (phase, group_name, game_number, home_team, away_team, home_flag, away_flag, game_date, venue) values
('group','J',55,'Quênia','Chile','🇰🇪','🇨🇱','2026-06-17 18:00:00-03','BC Place, Vancouver'),
('group','J',56,'Costa Rica','Turquia','🇨🇷','🇹🇷','2026-06-18 12:00:00-03','Estadio Akron, Guadalajara'),
('group','J',57,'Quênia','Turquia','🇰🇪','🇹🇷','2026-06-22 12:00:00-03','Estadio BBVA, Monterrey'),
('group','J',58,'Costa Rica','Chile','🇨🇷','🇨🇱','2026-06-22 15:00:00-03','BC Place, Vancouver'),
('group','J',59,'Chile','Turquia','🇨🇱','🇹🇷','2026-06-26 17:00:00-03','Hard Rock, Miami'),
('group','J',60,'Quênia','Costa Rica','🇰🇪','🇨🇷','2026-06-26 17:00:00-03','Estadio BBVA, Monterrey');

-- GRUPO K
insert into games (phase, group_name, game_number, home_team, away_team, home_flag, away_flag, game_date, venue) values
('group','K',61,'Equador','Botsuana','🇪🇨','🇧🇼','2026-06-18 15:00:00-03','Lumen Field, Seattle'),
('group','K',62,'Egito','Cuba','🇪🇬','🇨🇺','2026-06-18 21:00:00-03','BC Place, Vancouver'),
('group','K',63,'Equador','Cuba','🇪🇨','🇨🇺','2026-06-22 18:00:00-03','Hard Rock, Miami'),
('group','K',64,'Egito','Botsuana','🇪🇬','🇧🇼','2026-06-22 21:00:00-03','Mercedes-Benz, Atlanta'),
('group','K',65,'Botsuana','Cuba','🇧🇼','🇨🇺','2026-06-26 17:00:00-03','Arrowhead, Kansas City'),
('group','K',66,'Equador','Egito','🇪🇨','🇪🇬','2026-06-26 17:00:00-03','AT&T, Dallas');

-- GRUPO L
insert into games (phase, group_name, game_number, home_team, away_team, home_flag, away_flag, game_date, venue) values
('group','L',67,'Irã','Rep. Tcheca','🇮🇷','🇨🇿','2026-06-19 12:00:00-03','Allegiant, Las Vegas'),
('group','L',68,'Gana','Qatar','🇬🇭','🇶🇦','2026-06-19 15:00:00-03','Estadio Akron, Guadalajara'),
('group','L',69,'Irã','Qatar','🇮🇷','🇶🇦','2026-06-23 12:00:00-03','Levi''s, San Francisco'),
('group','L',70,'Gana','Rep. Tcheca','🇬🇭','🇨🇿','2026-06-23 15:00:00-03','Rose Bowl, Los Angeles'),
('group','L',71,'Rep. Tcheca','Qatar','🇨🇿','🇶🇦','2026-06-27 17:00:00-03','SoFi, Los Angeles'),
('group','L',72,'Irã','Gana','🇮🇷','🇬🇭','2026-06-27 17:00:00-03','Gillette, Boston');

-- Fases eliminatórias — serão preenchidas pelo admin conforme os jogos avançam
-- Oitavas de Final (Round of 32): 16 jogos (TBD)
-- Quartas de Final: 8 jogos (TBD)
-- Semifinal: 4 jogos (TBD)
-- Disputa de 3º: 1 jogo (TBD)
-- Final: 1 jogo (TBD)
