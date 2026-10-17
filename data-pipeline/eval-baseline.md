| model | dims | words covered | hit@100 | hit@1000 | median rank | spearman (ref) |
|---|---:|---:|---:|---:|---:|---:|
| glove300 | 300 | 31,885/31,885 | 69% | 95% | 35 | 0.71 |
| glove300@pca200 | 200 | 31,885/31,885 | 67% | 95% | 38 | 0.69 |
| glove300@pca128 | 128 | 31,885/31,885 | 64% | 94% | 38 | 0.68 |

### glove300

| target | hit@100 | hit@1000 | median | furthest golden words |
|---|---:|---:|---:|---|
| microscope | 45% | 86% | 156 | eyeglass #10,613, science #10,376, medicine #8,601, infection #3,616, scientific #1,576 |
| cheese | 71% | 96% | 35 | mouse #1,406, grate #488, cow #265, melt #261, ham #237 |
| ocean | 74% | 100% | 46 | salt #985, sailor #876, current #787, dolphin #319, tide #176 |
| doctor | 62% | 97% | 28 | symptom #3,845, vaccine #866, stethoscope #653, drug #281, disease #279 |
| guitar | 78% | 97% | 35 | fret #1,832, pick #479, strum #269, amplifier #141, chord #119 |
| winter | 64% | 86% | 50 | glove #7,803, scarf #6,162, fireplace #5,762, snowman #4,686, skate #938 |
| kitchen | 62% | 91% | 58 | dine #1,928, kettle #1,317, cabinet #1,015, pan #838, counter #637 |
| airport | 84% | 97% | 30 | custom #5,714, ticket #266, pilot #153, harbor #142, gate #109 |
| coffee | 73% | 97% | 32 | teapot #2,426, kettle #781, cup #531, grinder #430, donut #393 |
| forest | 62% | 100% | 48 | branch #833, fern #828, leaf #650, wolf #521, hike #513 |
| soldier | 50% | 94% | 96 | general #1,421, recruit #1,203, helmet #286, weapon #282, captain #239 |
| computer | 77% | 94% | 36 | compute #1,448, algorithm #1,167, virus #675, tablet #530, robot #172 |
| storm | 68% | 97% | 29 | drizzle #2,164, sky #670, shower #458, torrent #361, calm #288 |
| horse | 75% | 100% | 26 | mane #541, zebra #526, foal #452, trot #295, bridle #288 |
| teacher | 75% | 94% | 30 | chalk #4,642, blackboard #2,155, parent #650, coach #307, textbook #245 |
| volcano | 77% | 100% | 34 | summit #812, geology #750, landslide #567, fire #226, rock #169 |
| freedom | 69% | 97% | 61 | rebellion #1,979, liberalism #398, emancipation #337, patriotism #221, citizen #159 |
| anger | 75% | 97% | 25 | tantrum #1,698, upset #503, hate #215, aggression #196, revenge #187 |
| happy | 53% | 94% | 91 | content #2,256, blissful #2,182, thrill #763, jolly #588, merry #370 |
| cook | 84% | 97% | 34 | ingredient #2,839, steam #659, cuisine #240, food #237, breakfast #124 |

### glove300@pca200

| target | hit@100 | hit@1000 | median | furthest golden words |
|---|---:|---:|---:|---|
| microscope | 48% | 92% | 106 | eyeglass #11,965, science #3,467, medicine #2,992, infection #2,090, thermometer #1,328 |
| cheese | 68% | 96% | 30 | mouse #1,742, grate #583, melt #271, cow #234, fondue #208 |
| ocean | 71% | 94% | 41 | salt #1,027, sailor #1,010, current #618, dolphin #386, tide #170 |
| doctor | 56% | 91% | 37 | symptom #5,939, stethoscope #1,596, vaccine #1,026, healer #489, disease #347 |
| guitar | 84% | 97% | 34 | fret #3,047, strum #374, pick #348, amplifier #171, chord #116 |
| winter | 61% | 79% | 66 | glove #8,306, scarf #7,366, snowman #7,272, fireplace #6,764, skate #1,412 |
| kitchen | 62% | 94% | 52 | dine #1,700, kettle #1,371, toaster #958, pan #689, cabinet #665 |
| airport | 81% | 97% | 40 | custom #5,046, ticket #245, pilot #153, harbor #139, gate #119 |
| coffee | 67% | 97% | 36 | teapot #5,187, grinder #937, kettle #844, donut #811, cup #440 |
| forest | 62% | 97% | 44 | fern #1,050, leaf #837, hike #756, branch #547, lumber #506 |
| soldier | 53% | 97% | 94 | recruit #1,056, general #909, helmet #456, weapon #384, mercenary #335 |
| computer | 74% | 94% | 41 | compute #2,263, algorithm #1,586, virus #872, tablet #829, robot #199 |
| storm | 68% | 97% | 33 | drizzle #3,218, shower #618, sky #550, torrent #549, calm #377 |
| horse | 72% | 97% | 28 | zebra #1,079, bridle #882, foal #870, mane #852, trot #444 |
| teacher | 75% | 94% | 28 | chalk #5,429, blackboard #3,430, parent #746, textbook #374, coach #208 |
| volcano | 74% | 100% | 29 | geology #757, summit #448, landslide #440, cone #177, pumice #132 |
| freedom | 62% | 97% | 50 | rebellion #2,006, liberalism #793, emancipation #451, patriotism #365, tyranny #195 |
| anger | 75% | 97% | 24 | tantrum #2,877, upset #380, aggression #214, hate #191, revenge #170 |
| happy | 50% | 91% | 100 | blissful #3,781, content #2,514, thrill #1,017, jolly #612, merry #380 |
| cook | 81% | 97% | 35 | ingredient #4,462, steam #739, cuisine #311, food #207, barbecue #123 |

### glove300@pca128

| target | hit@100 | hit@1000 | median | furthest golden words |
|---|---:|---:|---:|---|
| microscope | 45% | 94% | 133 | eyeglass #14,503, infection #3,054, medicine #2,723, science #2,249, microbiology #884 |
| cheese | 64% | 96% | 37 | mouse #1,514, grate #664, melt #289, fondue #281, cow #274 |
| ocean | 77% | 97% | 46 | sailor #1,206, salt #853, current #780, dolphin #377, wave #215 |
| doctor | 56% | 91% | 34 | symptom #5,839, stethoscope #2,493, vaccine #1,597, healer #841, emergency #338 |
| guitar | 78% | 97% | 28 | fret #3,024, strum #527, pick #379, amplifier #248, chord #126 |
| winter | 50% | 75% | 108 | snowman #9,875, scarf #9,161, glove #8,714, fireplace #7,088, sled #3,356 |
| kitchen | 56% | 94% | 60 | dine #1,473, kettle #1,152, toaster #838, cabinet #829, plate #810 |
| airport | 72% | 97% | 45 | custom #4,898, ticket #273, harbor #223, gate #186, airspace #182 |
| coffee | 60% | 90% | 38 | teapot #4,102, grinder #2,690, kettle #1,015, donut #837, pastry #468 |
| forest | 62% | 94% | 42 | fern #1,291, hike #1,170, leaf #849, lumber #645, branch #614 |
| soldier | 56% | 100% | 76 | recruit #939, general #644, helmet #643, mercenary #392, weapon #360 |
| computer | 68% | 94% | 41 | compute #3,064, algorithm #2,304, tablet #970, virus #937, calculator #255 |
| storm | 61% | 94% | 36 | drizzle #3,784, shower #1,278, torrent #913, sky #615, calm #464 |
| horse | 66% | 91% | 33 | foal #1,488, bridle #1,382, mane #1,372, trot #595, hoof #514 |
| teacher | 69% | 94% | 26 | chalk #5,120, blackboard #4,029, parent #762, textbook #722, homework #316 |
| volcano | 71% | 100% | 35 | landslide #754, geology #730, summit #290, molten #270, fire #241 |
| freedom | 66% | 97% | 37 | rebellion #2,116, liberalism #817, tyranny #404, slavery #317, oppression #288 |
| anger | 78% | 97% | 26 | tantrum #3,752, upset #303, aggression #258, hate #174, temper #169 |
| happy | 50% | 94% | 99 | blissful #3,977, content #2,947, thrill #969, jolly #951, merry #482 |
| cook | 75% | 94% | 39 | ingredient #4,604, steam #1,666, cuisine #566, food #376, meal #141 |

Golden words the game rejects (vocabulary gaps, not scored):

- cheese: parmesan, brie, feta, gouda
- ocean: atlantic
- winter: december, january, february, christmas
- coffee: starbucks, barista
- computer: pc
- volcano: hawaii
