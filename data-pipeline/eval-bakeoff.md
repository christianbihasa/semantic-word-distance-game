| model | dims | words covered | hit@100 | hit@1000 | median rank | spearman (ref) |
|---|---:|---:|---:|---:|---:|---:|
| glove | 300 | 33,748/33,748 | 68% | 95% | 38 | 0.71 |
| nb | 300 | 33,638/33,748 | 66% | 98% | 57 | 0.74 |
| ft | 300 | 33,744/33,748 | 71% | 97% | 46 | 0.76 |
| glove+nb | 600 | 33,638/33,748 | 76% | 99% | 32 | 0.75 |
| ft+nb | 600 | 33,636/33,748 | 70% | 99% | 51 | 0.75 |
| glove+ft | 600 | 33,744/33,748 | 80% | 98% | 32 | 0.77 |
| glove@pca200 | 200 | 33,748/33,748 | 67% | 95% | 40 | 0.69 |
| nb@pca200 | 200 | 33,638/33,748 | 63% | 97% | 57 | 0.72 |
| ft@pca200 | 200 | 33,744/33,748 | 72% | 98% | 46 | 0.75 |
| glove+nb@pca200 | 200 | 33,638/33,748 | 75% | 98% | 35 | 0.72 |
| ft+nb@pca200 | 200 | 33,636/33,748 | 69% | 99% | 56 | 0.74 |
| glove+ft@pca200 | 200 | 33,744/33,748 | 78% | 97% | 30 | 0.74 |

### glove

| target | hit@100 | hit@1000 | median | furthest golden words |
|---|---:|---:|---:|---|
| microscope | 45% | 86% | 156 | eyeglass #10,738, science #10,491, medicine #8,685, infection #3,629, scientific #1,578 |
| cheese | 71% | 97% | 39 | mouse #1,438, grate #498, cow #273, melt #269, ham #245 |
| ocean | 72% | 97% | 50 | salt #1,083, sailor #966, current #871, dolphin #356, tide #192 |
| doctor | 62% | 97% | 28 | symptom #3,982, vaccine #872, stethoscope #655, drug #281, disease #279 |
| guitar | 78% | 97% | 35 | fret #1,848, pick #482, strum #269, amplifier #141, chord #119 |
| winter | 66% | 84% | 57 | glove #8,447, scarf #6,638, fireplace #6,200, snowman #5,036, skate #1,007 |
| kitchen | 62% | 91% | 58 | dine #1,944, kettle #1,329, cabinet #1,022, pan #844, counter #639 |
| airport | 81% | 97% | 32 | custom #6,675, ticket #318, pilot #179, harbor #165, gate #123 |
| coffee | 73% | 97% | 32 | teapot #2,505, kettle #792, cup #537, grinder #434, donut #396 |
| forest | 62% | 100% | 48 | branch #902, fern #897, leaf #696, wolf #555, hike #545 |
| soldier | 50% | 94% | 98 | general #1,470, recruit #1,243, helmet #296, weapon #291, captain #247 |
| computer | 77% | 94% | 36 | compute #1,453, algorithm #1,170, virus #676, tablet #530, robot #172 |
| storm | 65% | 97% | 30 | drizzle #2,334, sky #731, shower #501, torrent #397, calm #321 |
| horse | 75% | 100% | 26 | mane #542, zebra #527, foal #453, trot #296, bridle #289 |
| teacher | 75% | 94% | 30 | chalk #4,886, blackboard #2,210, parent #655, coach #307, textbook #245 |
| volcano | 69% | 100% | 46 | summit #937, geology #871, landslide #666, fire #272, rock #206 |
| freedom | 69% | 97% | 61 | rebellion #2,035, liberalism #401, emancipation #339, patriotism #223, citizen #159 |
| anger | 75% | 97% | 25 | tantrum #1,725, upset #503, hate #215, aggression #196, revenge #187 |
| happy | 53% | 94% | 91 | content #2,279, blissful #2,203, thrill #764, jolly #589, merry #371 |
| cook | 84% | 97% | 34 | ingredient #3,010, steam #673, cuisine #241, food #238, breakfast #124 |

### nb

| target | hit@100 | hit@1000 | median | furthest golden words |
|---|---:|---:|---:|---|
| microscope | 46% | 92% | 110 | medicine #7,429, infection #5,667, anatomy #3,129, tumor #2,006, membrane #1,794 |
| cheese | 71% | 100% | 51 | mouse #1,000, melt #618, grate #577, wine #295, cracker #283 |
| ocean | 50% | 94% | 104 | current #3,259, storm #1,169, deep #743, salt #658, voyage #459 |
| doctor | 59% | 97% | 70 | disease #1,261, drug #744, vaccine #712, illness #518, symptom #436 |
| guitar | 62% | 100% | 67 | pick #513, electric #374, rock #261, fret #240, string #237 |
| winter | 72% | 97% | 48 | scarf #1,143, glove #724, fireplace #533, skate #412, coat #169 |
| kitchen | 69% | 100% | 74 | breakfast #430, dine #287, bake #277, recipe #249, plate #210 |
| airport | 75% | 94% | 40 | custom #29,592, security #1,053, harbor #315, tourist #291, ticket #217 |
| coffee | 80% | 100% | 28 | morning #231, grinder #230, cream #189, pastry #158, wine #141 |
| forest | 50% | 100% | 98 | branch #688, bear #601, moss #502, hike #403, hunting #365 |
| soldier | 53% | 100% | 83 | helmet #599, wound #547, gun #514, general #430, weapon #350 |
| computer | 71% | 100% | 70 | code #528, robot #216, algorithm #214, phone #207, chip #194 |
| storm | 84% | 100% | 34 | sky #475, calm #419, damage #297, shower #265, wave #113 |
| horse | 78% | 100% | 50 | zebra #201, farm #183, mane #167, stable #151, sheep #122 |
| teacher | 69% | 97% | 40 | chalk #1,184, exam #226, university #201, learn #190, blackboard #132 |
| volcano | 62% | 100% | 63 | disaster #819, rock #552, fire #494, summit #197, dormant #193 |
| freedom | 62% | 91% | 72 | human #1,295, nation #1,156, law #1,138, struggle #882, rebellion #728 |
| anger | 78% | 100% | 36 | shame #252, violence #245, revenge #226, upset #210, hate #208 |
| happy | 66% | 94% | 42 | thrill #1,178, lonely #1,102, love #633, content #300, friendly #229 |
| cook | 69% | 100% | 41 | lunch #514, breakfast #490, ingredient #424, steam #338, serve #297 |

### ft

| target | hit@100 | hit@1000 | median | furthest golden words |
|---|---:|---:|---:|---|
| microscope | 45% | 92% | 137 | sensor #2,529, infection #2,196, medicine #2,195, radiation #1,768, scientific #1,141 |
| cheese | 77% | 100% | 37 | mouse #752, melt #429, slice #348, grate #214, cream #135 |
| ocean | 59% | 97% | 56 | current #12,418, deep #505, salt #503, storm #453, wave #368 |
| doctor | 66% | 100% | 59 | emergency #776, cure #527, disease #521, drug #422, symptom #420 |
| guitar | 69% | 97% | 42 | pick #1,935, concert #249, string #204, rock #201, jazz #183 |
| winter | 75% | 97% | 54 | glove #1,535, skate #550, coat #180, scarf #176, storm #164 |
| kitchen | 56% | 97% | 82 | dine #1,378, plate #735, bake #497, pot #451, pan #357 |
| airport | 72% | 97% | 43 | custom #31,579, harbor #728, ticket #577, pilot #292, landing #207 |
| coffee | 97% | 100% | 25 | cream #118, grinder #89, teapot #79, wine #71, juice #65 |
| forest | 47% | 94% | 106 | branch #1,853, bear #1,340, leaf #440, lumber #338, hunting #274 |
| soldier | 62% | 91% | 72 | general #3,295, wound #1,798, recruit #1,596, marine #604, helmet #416 |
| computer | 71% | 100% | 49 | code #820, chip #483, algorithm #482, compute #349, memory #178 |
| storm | 81% | 100% | 28 | shower #685, damage #268, sky #192, drizzle #168, cloud #128 |
| horse | 84% | 100% | 28 | derby #509, stable #198, farm #135, sheep #114, ranch #103 |
| teacher | 81% | 94% | 34 | chalk #2,608, learn #1,295, exam #388, college #343, graduate #267 |
| volcano | 66% | 91% | 52 | mount #14,086, disaster #1,362, peak #1,063, fire #317, dormant #275 |
| freedom | 62% | 97% | 54 | nation #1,648, human #739, law #577, citizen #536, rebellion #256 |
| anger | 88% | 100% | 34 | upset #204, hate #147, shame #142, revenge #114, tantrum #86 |
| happy | 81% | 94% | 34 | content #4,650, thrill #2,289, lonely #193, love #188, laugh #174 |
| cook | 75% | 100% | 34 | lunch #503, steam #315, ingredient #314, heat #280, pot #244 |

### glove+nb

| target | hit@100 | hit@1000 | median | furthest golden words |
|---|---:|---:|---:|---|
| microscope | 54% | 94% | 85 | medicine #6,877, infection #3,478, science #2,489, membrane #1,021, tumor #845 |
| cheese | 71% | 97% | 37 | mouse #1,070, grate #488, melt #376, cow #238, cracker #192 |
| ocean | 75% | 97% | 42 | current #1,349, salt #509, storm #228, deep #213, sailor #167 |
| doctor | 72% | 100% | 58 | symptom #942, vaccine #496, disease #394, drug #305, illness #165 |
| guitar | 78% | 100% | 34 | pick #405, fret #335, electric #189, string #153, amplifier #146 |
| winter | 75% | 91% | 36 | scarf #2,681, glove #2,623, fireplace #1,566, skate #346, snowman #198 |
| kitchen | 59% | 100% | 49 | dine #452, pan #260, bake #236, plate #223, counter #217 |
| airport | 84% | 97% | 28 | custom #12,577, ticket #161, security #142, harbor #139, tourist #115 |
| coffee | 80% | 100% | 18 | grinder #209, teapot #164, morning #143, pastry #141, kettle #116 |
| forest | 59% | 100% | 48 | branch #530, bear #370, hike #321, fern #297, wolf #271 |
| soldier | 75% | 100% | 54 | general #510, recruit #359, helmet #304, wound #246, gun #236 |
| computer | 84% | 100% | 30 | algorithm #271, code #164, tablet #128, robot #125, virus #107 |
| storm | 87% | 100% | 26 | sky #384, calm #240, drizzle #232, shower #229, turbulence #87 |
| horse | 91% | 100% | 28 | zebra #157, mane #137, stable #109, farm #80, ranch #78 |
| teacher | 84% | 97% | 25 | chalk #2,036, blackboard #352, parent #165, textbook #115, exam #114 |
| volcano | 72% | 100% | 40 | summit #287, fire #285, rock #264, disaster #255, landslide #183 |
| freedom | 81% | 100% | 30 | rebellion #852, nation #220, law #215, choice #133, citizen #122 |
| anger | 78% | 100% | 28 | upset #251, hate #180, tantrum #177, revenge #176, aggression #133 |
| happy | 88% | 100% | 30 | thrill #664, content #627, lonely #355, friendly #143, love #98 |
| cook | 81% | 100% | 28 | ingredient #652, steam #293, breakfast #186, lunch #146, restaurant #104 |

### ft+nb

| target | hit@100 | hit@1000 | median | furthest golden words |
|---|---:|---:|---:|---|
| microscope | 46% | 94% | 115 | medicine #3,794, infection #3,237, membrane #1,235, radiation #1,151, tumor #906 |
| cheese | 74% | 100% | 43 | mouse #860, melt #513, grate #390, slice #247, cracker #189 |
| ocean | 53% | 97% | 72 | current #5,701, storm #791, deep #597, salt #552, voyage #337 |
| doctor | 62% | 100% | 56 | disease #750, drug #536, vaccine #509, symptom #398, emergency #365 |
| guitar | 62% | 100% | 51 | pick #674, electric #271, rock #234, string #216, fret #193 |
| winter | 75% | 100% | 55 | glove #888, scarf #458, skate #421, fireplace #287, coat #163 |
| kitchen | 59% | 100% | 66 | dine #444, bake #307, plate #299, breakfast #254, pan #238 |
| airport | 78% | 97% | 37 | custom #31,385, security #414, harbor #382, ticket #272, tourist #159 |
| coffee | 93% | 100% | 22 | grinder #148, cream #147, morning #100, wine #95, roast #81 |
| forest | 50% | 100% | 100 | branch #943, bear #779, hike #315, hunting #308, leaf #294 |
| soldier | 56% | 100% | 67 | general #860, wound #787, recruit #466, helmet #454, gun #404 |
| computer | 74% | 100% | 59 | code #567, algorithm #265, chip #243, robot #150, memory #145 |
| storm | 84% | 100% | 33 | shower #336, sky #304, damage #264, calm #146, drizzle #107 |
| horse | 84% | 100% | 40 | stable #163, farm #158, zebra #154, derby #121, sheep #117 |
| teacher | 81% | 97% | 38 | chalk #1,639, learn #397, exam #255, university #199, college #127 |
| volcano | 69% | 100% | 50 | mount #910, disaster #894, fire #367, rock #351, peak #216 |
| freedom | 62% | 97% | 58 | nation #1,182, human #896, law #756, rebellion #405, citizen #335 |
| anger | 84% | 100% | 34 | upset #199, shame #185, hate #168, revenge #162, violence #143 |
| happy | 75% | 97% | 29 | thrill #1,435, content #827, lonely #475, love #353, laugh #154 |
| cook | 75% | 100% | 40 | lunch #463, ingredient #348, breakfast #324, steam #311, serve #224 |

### glove+ft

| target | hit@100 | hit@1000 | median | furthest golden words |
|---|---:|---:|---:|---|
| microscope | 56% | 94% | 89 | medicine #3,746, science #2,172, infection #2,017, eyeglass #1,416, scientific #908 |
| cheese | 77% | 100% | 28 | mouse #935, grate #331, melt #276, cow #162, slice #142 |
| ocean | 75% | 97% | 32 | current #2,075, salt #496, sailor #333, wave #152, deep #149 |
| doctor | 75% | 100% | 38 | symptom #953, vaccine #353, disease #234, drug #207, emergency #188 |
| guitar | 88% | 100% | 34 | pick #588, fret #329, concert #128, string #116, electric #95 |
| winter | 75% | 94% | 34 | glove #3,868, scarf #1,037, fireplace #805, snowman #450, skate #412 |
| kitchen | 66% | 97% | 54 | dine #1,165, kettle #416, plate #407, pan #398, counter #336 |
| airport | 88% | 97% | 33 | custom #14,311, ticket #263, harbor #194, pilot #137, travel #82 |
| coffee | 90% | 100% | 17 | teapot #363, kettle #157, grinder #151, donut #85, pastry #82 |
| forest | 72% | 100% | 33 | branch #825, bear #494, leaf #374, lumber #274, hike #260 |
| soldier | 72% | 97% | 50 | general #1,366, recruit #889, wound #321, helmet #234, weapon #172 |
| computer | 87% | 100% | 31 | algorithm #478, compute #468, code #180, tablet #107, virus #90 |
| storm | 84% | 100% | 28 | drizzle #527, shower #385, sky #277, torrent #143, turbulence #103 |
| horse | 94% | 100% | 26 | stable #130, zebra #111, mane #88, ranch #76, trot #71 |
| teacher | 78% | 97% | 22 | chalk #2,953, blackboard #339, learn #172, parent #146, exam #130 |
| volcano | 69% | 100% | 38 | disaster #241, landslide #224, fire #215, summit #181, geology #160 |
| freedom | 81% | 100% | 30 | rebellion #592, nation #263, citizen #167, law #158, patriotism #128 |
| anger | 88% | 100% | 25 | tantrum #308, upset #257, hate #150, revenge #134, contempt #81 |
| happy | 88% | 97% | 32 | content #2,432, thrill #929, blissful #284, lonely #158, laugh #100 |
| cook | 94% | 100% | 20 | ingredient #681, steam #306, breakfast #95, lunch #93, cuisine #78 |

### glove@pca200

| target | hit@100 | hit@1000 | median | furthest golden words |
|---|---:|---:|---:|---|
| microscope | 48% | 90% | 116 | eyeglass #12,179, science #3,529, medicine #3,078, infection #2,182, thermometer #1,369 |
| cheese | 68% | 97% | 33 | mouse #1,713, grate #586, melt #277, cow #243, gouda #226 |
| ocean | 72% | 94% | 46 | salt #1,161, sailor #1,113, current #687, dolphin #441, tide #199 |
| doctor | 56% | 91% | 39 | symptom #6,408, stethoscope #1,638, vaccine #1,051, healer #543, disease #328 |
| guitar | 84% | 97% | 36 | fret #3,089, pick #354, strum #349, amplifier #169, chord #119 |
| winter | 62% | 81% | 49 | glove #9,123, scarf #8,459, snowman #7,670, fireplace #7,314, skate #1,504 |
| kitchen | 62% | 94% | 52 | dine #1,763, kettle #1,449, toaster #986, cabinet #694, pan #688 |
| airport | 78% | 97% | 42 | custom #5,915, ticket #289, pilot #185, harbor #168, gate #143 |
| coffee | 67% | 97% | 34 | teapot #5,438, grinder #947, kettle #885, donut #800, cup #466 |
| forest | 62% | 97% | 44 | fern #1,179, leaf #910, hike #896, branch #663, lumber #585 |
| soldier | 56% | 97% | 95 | recruit #1,082, general #963, helmet #466, weapon #404, mercenary #352 |
| computer | 74% | 94% | 40 | compute #2,262, algorithm #1,636, virus #861, tablet #775, robot #203 |
| storm | 65% | 97% | 34 | drizzle #3,594, shower #668, torrent #622, sky #611, calm #417 |
| horse | 72% | 97% | 28 | zebra #1,064, foal #867, bridle #835, mane #798, trot #436 |
| teacher | 75% | 94% | 26 | chalk #6,012, blackboard #3,668, parent #746, textbook #355, coach #204 |
| volcano | 69% | 100% | 41 | geology #955, summit #606, landslide #473, cone #189, pumice #163 |
| freedom | 62% | 97% | 52 | rebellion #2,154, liberalism #826, emancipation #506, patriotism #350, tyranny #201 |
| anger | 75% | 97% | 24 | tantrum #3,019, upset #395, aggression #217, hate #205, temper #171 |
| happy | 50% | 91% | 103 | blissful #3,907, content #2,471, thrill #1,005, jolly #607, merry #388 |
| cook | 81% | 97% | 34 | ingredient #4,541, steam #804, cuisine #337, food #201, barbecue #130 |

### nb@pca200

| target | hit@100 | hit@1000 | median | furthest golden words |
|---|---:|---:|---:|---|
| microscope | 49% | 90% | 111 | infection #4,542, medicine #3,267, membrane #2,150, tumor #1,527, anatomy #1,494 |
| cheese | 68% | 100% | 52 | mouse #972, melt #694, grate #531, wine #423, cracker #417 |
| ocean | 50% | 94% | 103 | current #3,072, storm #1,321, deep #848, salt #784, voyage #520 |
| doctor | 56% | 94% | 81 | disease #1,621, drug #1,417, illness #754, symptom #753, vaccine #661 |
| guitar | 59% | 100% | 66 | pick #752, electric #397, rock #338, fret #331, string #226 |
| winter | 75% | 94% | 51 | scarf #1,126, fireplace #1,062, glove #757, skate #370, sled #208 |
| kitchen | 62% | 100% | 72 | bake #311, recipe #310, dine #295, plate #269, breakfast #256 |
| airport | 66% | 94% | 44 | custom #23,858, security #1,312, harbor #393, tourist #339, travel #266 |
| coffee | 73% | 100% | 28 | morning #291, grinder #288, roast #235, cream #198, pastry #184 |
| forest | 47% | 100% | 122 | bear #625, branch #557, moss #527, river #396, hike #385 |
| soldier | 53% | 100% | 85 | helmet #747, wound #581, general #472, gun #443, recruit #377 |
| computer | 55% | 100% | 91 | algorithm #279, screen #238, code #219, memory #205, virus #187 |
| storm | 84% | 100% | 34 | sky #551, calm #518, shower #298, damage #200, wave #134 |
| horse | 78% | 100% | 48 | farm #196, stable #193, zebra #179, mane #178, sheep #121 |
| teacher | 62% | 97% | 40 | chalk #1,592, university #233, exam #218, learn #195, textbook #171 |
| volcano | 59% | 97% | 62 | disaster #1,109, rock #510, fire #372, dormant #331, summit #219 |
| freedom | 56% | 91% | 88 | nation #1,663, human #1,586, struggle #1,126, rebellion #822, religion #758 |
| anger | 78% | 100% | 39 | upset #264, revenge #257, shame #237, violence #225, hate #197 |
| happy | 62% | 94% | 46 | lonely #1,333, thrill #1,074, love #654, wonderful #367, content #278 |
| cook | 62% | 100% | 45 | ingredient #503, lunch #449, heat #389, steam #377, serve #329 |

### ft@pca200

| target | hit@100 | hit@1000 | median | furthest golden words |
|---|---:|---:|---:|---|
| microscope | 42% | 94% | 136 | infection #2,380, membrane #2,020, radiation #1,351, medicine #1,001, molecule #914 |
| cheese | 74% | 100% | 40 | mouse #717, melt #399, slice #346, grate #273, cream #154 |
| ocean | 69% | 97% | 50 | current #6,283, deep #414, salt #408, wave #285, sailor #278 |
| doctor | 66% | 100% | 56 | disease #784, emergency #644, symptom #489, cure #467, drug #365 |
| guitar | 72% | 97% | 45 | pick #1,459, rock #205, concert #163, jazz #162, fret #158 |
| winter | 72% | 97% | 51 | glove #1,349, skate #323, fireplace #209, scarf #203, coat #163 |
| kitchen | 59% | 97% | 78 | dine #1,147, pot #708, plate #493, pan #473, bake #377 |
| airport | 66% | 97% | 46 | custom #26,386, harbor #694, ticket #342, pilot #213, landing #153 |
| coffee | 97% | 100% | 24 | cream #141, grinder #97, teapot #92, roast #67, bean #64 |
| forest | 53% | 100% | 84 | branch #808, bear #513, leaf #491, lumber #378, hunting #254 |
| soldier | 62% | 94% | 72 | general #3,690, wound #1,530, marine #760, recruit #741, helmet #376 |
| computer | 81% | 100% | 66 | algorithm #492, chip #470, compute #390, code #334, memory #172 |
| storm | 87% | 97% | 26 | shower #1,134, damage #155, drizzle #135, sky #123, torrent #89 |
| horse | 84% | 100% | 28 | derby #422, stable #170, farm #117, zebra #107, sheep #106 |
| teacher | 81% | 97% | 31 | chalk #2,275, learn #356, university #270, college #256, exam #216 |
| volcano | 66% | 94% | 58 | mount #9,692, disaster #1,035, peak #692, dormant #551, hawaii #395 |
| freedom | 66% | 97% | 46 | human #1,149, nation #968, law #823, citizen #599, constitution #318 |
| anger | 88% | 100% | 30 | upset #206, shame #121, revenge #118, hate #105, tantrum #83 |
| happy | 84% | 94% | 38 | content #3,416, thrill #1,604, lonely #298, laugh #221, love #139 |
| cook | 78% | 100% | 28 | ingredient #494, heat #404, pot #318, steam #224, lunch #204 |

### glove+nb@pca200

| target | hit@100 | hit@1000 | median | furthest golden words |
|---|---:|---:|---:|---|
| microscope | 49% | 93% | 102 | medicine #3,231, infection #2,434, science #1,455, tumor #1,147, membrane #1,041 |
| cheese | 71% | 97% | 42 | mouse #1,184, grate #618, melt #512, cow #295, cracker #262 |
| ocean | 75% | 97% | 48 | current #1,032, salt #604, deep #210, storm #197, wave #182 |
| doctor | 66% | 97% | 51 | symptom #2,278, vaccine #680, disease #505, drug #460, illness #235 |
| guitar | 78% | 100% | 35 | fret #665, pick #461, electric #207, amplifier #191, string #133 |
| winter | 75% | 91% | 36 | scarf #4,425, fireplace #4,166, glove #3,391, snowman #379, skate #299 |
| kitchen | 62% | 100% | 68 | dine #425, counter #329, pan #291, plate #277, bake #246 |
| airport | 84% | 97% | 28 | custom #10,380, harbor #210, security #148, tourist #136, ticket #112 |
| coffee | 77% | 100% | 22 | teapot #444, grinder #401, pastry #206, morning #174, roast #165 |
| forest | 56% | 100% | 56 | bear #436, branch #380, hike #335, wolf #293, leaf #281 |
| soldier | 72% | 100% | 54 | general #471, helmet #411, recruit #393, weapon #247, wound #227 |
| computer | 84% | 100% | 31 | virus #472, algorithm #319, tablet #216, compute #186, code #102 |
| storm | 84% | 100% | 25 | sky #496, drizzle #381, calm #345, shower #296, turbulence #104 |
| horse | 91% | 100% | 28 | zebra #175, mane #163, stable #127, ranch #91, cowboy #87 |
| teacher | 75% | 97% | 23 | chalk #3,030, blackboard #626, parent #182, textbook #166, homework #111 |
| volcano | 72% | 100% | 53 | rock #262, disaster #258, landslide #253, summit #242, fire #200 |
| freedom | 78% | 97% | 35 | rebellion #1,277, choice #188, religion #168, nation #163, slavery #128 |
| anger | 81% | 100% | 30 | upset #267, tantrum #199, revenge #198, hate #158, aggression #155 |
| happy | 91% | 100% | 30 | thrill #825, content #768, lonely #405, blissful #97, love #92 |
| cook | 78% | 97% | 32 | ingredient #1,045, steam #391, breakfast #177, food #147, lunch #122 |

### ft+nb@pca200

| target | hit@100 | hit@1000 | median | furthest golden words |
|---|---:|---:|---:|---|
| microscope | 49% | 94% | 104 | infection #3,105, medicine #1,749, membrane #1,207, anatomy #1,019, radiation #774 |
| cheese | 71% | 100% | 54 | mouse #957, melt #674, grate #415, slice #292, cracker #251 |
| ocean | 59% | 97% | 76 | current #5,091, storm #802, deep #682, salt #588, horizon #337 |
| doctor | 62% | 100% | 70 | disease #990, drug #686, vaccine #683, symptom #513, illness #457 |
| guitar | 66% | 100% | 60 | pick #809, rock #301, electric #277, fret #249, string #188 |
| winter | 78% | 100% | 46 | glove #913, scarf #581, fireplace #499, skate #364, sled #185 |
| kitchen | 69% | 100% | 76 | dine #524, plate #327, bake #326, pan #271, counter #258 |
| airport | 78% | 97% | 38 | custom #26,573, harbor #603, security #494, tourist #252, travel #193 |
| coffee | 83% | 100% | 22 | grinder #194, cream #182, roast #150, pastry #108, wine #101 |
| forest | 47% | 100% | 122 | bear #666, branch #641, leaf #387, hunting #342, nature #319 |
| soldier | 56% | 100% | 82 | general #871, wound #819, helmet #567, recruit #464, gun #373 |
| computer | 68% | 100% | 57 | algorithm #302, code #210, memory #200, screen #181, network #177 |
| storm | 81% | 100% | 33 | shower #670, sky #299, calm #189, damage #169, drizzle #108 |
| horse | 78% | 100% | 42 | stable #190, farm #166, zebra #143, mane #119, derby #114 |
| teacher | 78% | 97% | 37 | chalk #1,975, learn #297, exam #179, university #158, nurse #126 |
| volcano | 66% | 97% | 59 | disaster #1,105, mount #931, dormant #466, rock #288, fire #272 |
| freedom | 62% | 97% | 61 | human #1,622, nation #982, law #770, rebellion #466, citizen #394 |
| anger | 84% | 100% | 36 | upset #238, shame #187, revenge #170, violence #139, hate #120 |
| happy | 66% | 97% | 30 | thrill #1,354, content #732, lonely #697, love #376, laugh #196 |
| cook | 75% | 100% | 40 | ingredient #474, heat #351, lunch #306, steam #236, serve #187 |

### glove+ft@pca200

| target | hit@100 | hit@1000 | median | furthest golden words |
|---|---:|---:|---:|---|
| microscope | 52% | 94% | 95 | medicine #2,184, infection #1,886, eyeglass #1,638, science #1,399, membrane #945 |
| cheese | 81% | 97% | 26 | mouse #1,115, grate #553, melt #435, slice #196, cow #177 |
| ocean | 81% | 97% | 36 | current #1,414, salt #478, sailor #369, wave #205, deep #162 |
| doctor | 69% | 97% | 54 | symptom #2,835, vaccine #432, disease #292, cure #291, drug #235 |
| guitar | 88% | 100% | 32 | fret #829, pick #541, electric #106, concert #103, string #100 |
| winter | 75% | 88% | 36 | glove #4,941, scarf #2,642, fireplace #2,586, snowman #1,556, skate #581 |
| kitchen | 62% | 100% | 50 | dine #967, pan #415, counter #406, plate #367, bake #348 |
| airport | 84% | 97% | 30 | custom #10,933, harbor #277, pilot #144, ticket #138, gate #106 |
| coffee | 80% | 97% | 18 | teapot #1,337, grinder #330, kettle #272, donut #250, pastry #156 |
| forest | 69% | 100% | 31 | branch #478, bear #424, leaf #374, lumber #336, fern #311 |
| soldier | 69% | 97% | 50 | general #1,028, recruit #702, helmet #313, wound #255, weapon #232 |
| computer | 87% | 100% | 28 | compute #940, algorithm #496, virus #259, tablet #121, mouse #86 |
| storm | 81% | 100% | 25 | drizzle #840, shower #417, sky #251, torrent #213, calm #141 |
| horse | 91% | 100% | 26 | zebra #171, stable #166, mane #102, cowboy #88, ranch #81 |
| teacher | 75% | 97% | 21 | chalk #3,710, blackboard #573, parent #191, learn #144, textbook #142 |
| volcano | 72% | 100% | 46 | geology #229, landslide #202, summit #188, disaster #186, dormant #182 |
| freedom | 81% | 97% | 28 | rebellion #1,041, liberalism #205, patriotism #202, nation #163, citizen #158 |
| anger | 88% | 100% | 24 | tantrum #378, upset #278, revenge #148, hate #118, aggression #88 |
| happy | 78% | 94% | 39 | content #2,648, thrill #1,143, blissful #669, lonely #213, jolly #159 |
| cook | 91% | 97% | 24 | ingredient #1,258, steam #322, cuisine #106, food #77, breakfast #63 |

Golden words the game rejects (vocabulary gaps, not scored):

- cheese: feta
- coffee: starbucks, barista
- computer: pc
