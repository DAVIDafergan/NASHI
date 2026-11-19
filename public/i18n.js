/* Rabeinu Sheli – lightweight i18n (he → en / es). Translates rendered text nodes + attributes, incl. dynamic content. */
(function () {
  var Q = new URLSearchParams(location.search).get('lang'), L = 'he';
  try { if (Q && /^(he|en|es)$/.test(Q)) localStorage.setItem('rb-lang', Q); L = localStorage.getItem('rb-lang') || 'he'; } catch (e) { if (Q) L = Q; }
  if (!/^(en|es)$/.test(L)) L = 'he';
  var H = document.documentElement; H.lang = L; H.dir = L === 'he' ? 'rtl' : 'ltr';
  window.RB_LANG = L; window.RB_LOC = { he: 'he-IL', en: 'en-US', es: 'es-ES' }[L];
  window.RB_LQ = L === 'he' ? '' : '?lang=' + L;
  var I = L === 'en' ? 1 : 2;

  // [hebrew, english, spanish]   {n}=number   {s}=any text
  var D = [
['דלגו לתוכן הראשי','Skip to main content','Saltar al contenido principal'],
['איך זה עובד','How it works','Cómo funciona'],
['המתמטיקה של האור','The math of light','Las cuentas de la luz'],
['המפה','The map','El mapa'],
['שאלות','FAQ','Preguntas'],
['אני רוצה קופה','I want a box','Quiero una alcancía'],
['קופה מעוצבת שיושבת ליד התפילין. כל בוקר שקל אחד. ובראש השנה – כל השקלים הופכים לכרטיסי טיסה לאומן, ליהודים שעוד לא זכו.','A beautiful tzedakah box that sits next to your tefillin. One shekel every morning. And on Rosh Hashanah – all the shekels become flight tickets to Uman, for Jews who have never been.','Una alcancía de tzedaká que vive junto a tus tefilín. Un shéquel cada mañana. Y en Rosh Hashaná, todos los shéquels se convierten en pasajes a Umán para judíos que todavía no pudieron ir.'],
['אני רוצה קופה – עד הבית ←','Get a box – delivered home →','Quiero una alcancía – a domicilio →'],
['שקל חדש','New shekel','Nuevo shéquel'],
['סרקו לקופה שלכם','Scan for your box','Escanea para tu alcancía'],
['שקל אחד','One shekel','Un shéquel'],['יהודי אחד','One Jew','Un judío'],['אומן','Uman','Umán'],['ראש השנה','Rosh Hashanah','Rosh Hashaná'],
['אין שום יאוש','Never despair','Nunca desesperes'],
['מצוה גדולה להיות בשמחה','It is a great mitzvah to be joyful','Es una gran mitzvá estar alegre'],
['📦 בדרך אליך · שליח באזור','📦 On its way · courier nearby','📦 En camino · mensajero cerca'],
['בוקר ראשון','First morning','Primera mañana'],
['ישראל','Israel','Israel'],
['{n} ק״מ','{n} km','{n} km'],
['מהשקל שלך – עד הציון','From your shekel – to the Tziyun','De tu shéquel – hasta el Tziún'],
['הקופה','The box','La alcancía'],
['מגיעה עד','comes right to','llega hasta'],
['הדלת שלך.','your door.','tu puerta.'],
['שליח מביא קופה מעוצבת עם מספר אישי, בגודל שנכנס בדיוק ליד התיק של התפילין.','A courier brings you a designed box with its own number, sized to sit right next to your tefillin bag.','Un mensajero te trae una alcancía con su número personal, del tamaño justo para estar junto a la bolsa de los tefilín.'],
['הבוקר','The morning','La mañana'],
['שקל אחד.','One shekel.','Un shéquel.'],
['כל בוקר.','Every morning.','Cada mañana.'],
['ב"ויברך דוד", לפני ההנחה – או מתי שנוח לך. תזכורת קטנה בשעה שתבחר, ורצף ימים שגדל.','At "Vayevarech David", before putting on tefillin – or whenever suits you. A small reminder at the time you choose, and a streak that keeps growing.','En "Vaybarej David", antes de ponerte los tefilín, o cuando te quede cómodo. Un pequeño recordatorio a la hora que elijas y una racha que crece.'],
['עוד יהודי','One more Jew','Un judío más'],
['אצל רבינו.','with Rebbe Nachman.','con el Rebe Najmán.'],
['אוספים את הקופות, וכל','We collect the boxes, and every','Recogemos las alcancías, y cada'],
['הופכים לכרטיס טיסה ליהודי שעוד לא זכה לעמוד ליד הציון.','becomes a flight ticket for a Jew who has never stood at the Tziyun.','se convierte en un pasaje para un judío que nunca estuvo junto al Tziún.'],
['בזמן אמת','Live','En tiempo real'],
['האור כבר','The light is already','La luz ya está'],
['בדרך.','on its way.','en camino.'],
['קופות פעילות','Active boxes','Alcancías activas'],
['נכנסים לקופות כל בוקר','go into the boxes every morning','entran a las alcancías cada mañana'],
['יהודים בדרך לאומן','Jews on their way to Uman','judíos camino a Umán'],
['בקרים עד ראש השנה','mornings until Rosh Hashanah','mañanas hasta Rosh Hashaná'],
['היעד שלנו:','Our goal:','Nuestra meta:'],
['קופות בשבועיים','boxes in two weeks','alcancías en dos semanas'],
['שקל נשמע קטן.','A shekel sounds small.','Un shéquel suena a poco.'],
['עד שסופרים.','Until you count.','Hasta que cuentas.'],
['כמה קופות? משפחה, בית כנסת, שכונה…','How many boxes? A family, a shul, a neighborhood…','¿Cuántas alcancías? Una familia, una sinagoga, un barrio…'],
['גררו וראו מה קורה ←','Drag and see what happens →','Desliza y mira lo que pasa →'],
['שקלים בכל בוקר','shekels every morning','shéquels cada mañana'],
['עד ראש השנה','until Rosh Hashanah','hasta Rosh Hashaná'],
['יהודים שיגיעו לאומן','Jews who will reach Uman','judíos que llegarán a Umán'],
['מכאן – לאומן','From here – to Uman','De aquí – a Umán'],
['מדן ועד','From Dan','De Dan'],
['אילת.','to Eilat.','a Eilat.'],
['קופות ב-','boxes in','alcancías en'],
['ערים ויישובים. כל נקודה היא שקל בכל בוקר – ויהודי אחד שמתקרב לרבינו.','towns and cities. Every dot is a shekel each morning – and one more Jew getting closer to Rebbe Nachman.','ciudades y pueblos. Cada punto es un shéquel cada mañana, y un judío más cerca del Rebe Najmán.'],
['להדליק נקודה בעיר שלי ←','Light up a dot in my city →','Encender un punto en mi ciudad →'],
['↑ אומן · {n} ק״מ','↑ Uman · {n} km','↑ Umán · {n} km'],
['"אם אתה מאמין שיכולים לקלקל – תאמין שיכולים לתקן"','"If you believe you can damage – believe you can repair"','"Si crees que se puede dañar, cree que se puede reparar"'],
['אם אתה מאמין שיכולים לקלקל – תאמין שיכולים לתקן','If you believe you can damage – believe you can repair','Si crees que se puede dañar, cree que se puede reparar'],
['רבי נחמן מברסלב · ליקוטי מוהר"ן ח"ב, קיב','Rebbe Nachman of Breslov · Likutei Moharan II, 112','Rebe Najmán de Breslov · Likutei Moharán II, 112'],
['רבי נחמן מברסלב ·','Rebbe Nachman of Breslov ·','Rebe Najmán de Breslov ·'],
['ליקוטי מוהר"ן ח"ב, קיב','Likutei Moharan II, 112','Likutei Moharán II, 112'],
['מצוה גדולה להיות בשמחה תמיד','It is a great mitzvah to always be joyful','Es una gran mitzvá estar siempre alegre'],
['ליקוטי מוהר"ן ח"ב, כד','Likutei Moharan II, 24','Likutei Moharán II, 24'],
['כל העולם כולו גשר צר מאד, והעיקר לא לפחד כלל','The whole world is a very narrow bridge, and the main thing is not to be afraid at all','El mundo entero es un puente muy angosto, y lo principal es no tener miedo'],
['ליקוטי מוהר"ן ח"ב, מח','Likutei Moharan II, 48','Likutei Moharán II, 48'],
['אין שום יאוש בעולם כלל','There is no despair in the world at all','No existe la desesperación en absoluto'],
['ליקוטי מוהר"ן ח"ב, עח','Likutei Moharan II, 78','Likutei Moharán II, 78'],
['הראש השנה שלי עולה על הכל','My Rosh Hashanah is above everything','Mi Rosh Hashaná está por encima de todo'],
['חיי מוהר"ן','Chayei Moharan','Jaiéi Moharán'],
['#רבינו_שלי','#RabeinuSheli','#RabeinuSheli'],
['הקופה שכולם','The box everyone','La alcancía que todos'],
['מצלמים.','photographs.','fotografían.'],
['לכל קופה מספר אישי. מצלמים ליד התפילין, משתפים, ומזמינים חבר – וכל הזמנה מדליקה עוד נקודה במפה.','Every box has its own number. Snap it next to your tefillin, share, invite a friend – and every invite lights another dot on the map.','Cada alcancía tiene su número. Fotografíala junto a los tefilín, compártela, invita a un amigo, y cada invitación enciende otro punto en el mapa.'],
['כרטיס סטורי אישי','Personal story card','Tarjeta personal para historias'],
['תמונה מעוצבת עם מספר הקופה שלך – מוכנה לסטטוס ולאינסטגרם.','A designed image with your box number – ready for WhatsApp status and Instagram.','Una imagen diseñada con el número de tu alcancía, lista para estados e Instagram.'],
['קישור הזמנה משלך','Your own invite link','Tu propio enlace de invitación'],
['רואים באזור האישי כמה יהודים הצטרפו בזכותך.','See in your personal area how many joined thanks to you.','En tu área personal ves cuántos se sumaron gracias a ti.'],
['רצף בוקר','Morning streak','Racha matutina'],
['לוחצים "שמתי היום" – והרצף גדל, יום אחרי יום.','Tap "I gave today" – and the streak grows, day after day.','Toca "Ya puse hoy" y la racha crece, día tras día.'],
['לקחתי על עצמי','I took upon myself','Me comprometí a'],
['שקל ביום','a shekel a day','un shéquel al día'],
['לרבינו','for Rebbe Nachman','por el Rebe Najmán'],
['קופה מס׳ {n}','Box No. {n}','Alcancía N.º {n}'],
['קופה מס׳','Box No.','Alcancía N.º'],
['הצטרפו גם ←','Join too →','Súmate tú también →'],
['מה שרציתם לדעת','What you wanted to know','Lo que querías saber'],
['מה בדיוק מתחייבים?','What exactly am I committing to?','¿A qué me comprometo exactamente?'],
['לשים שקל אחד (או יותר, לבחירתכם) בקופה בכל יום. זו קבלה טובה, לא חוזה – אפשר לשנות או להפסיק בכל רגע מהאזור האישי.','To put one shekel (or more, your choice) in the box every day. It is a good resolution, not a contract – you can change or stop anytime from your personal area.','A poner un shéquel (o más, como quieras) en la alcancía cada día. Es una buena resolución, no un contrato: puedes cambiarla o dejarla cuando quieras desde tu área personal.'],
['פספסתי יום. מה עכשיו?','I missed a day. Now what?','Me salteé un día. ¿Y ahora?'],
['שמים מחר שניים. אין שום יאוש בעולם כלל 🙂 האזור האישי סופר בשבילכם כמה אמור להיות בקופה.','Put in two tomorrow. There is no despair in the world at all 🙂 Your personal area keeps count of what should be in the box.','Mañana pones dos. No existe la desesperación 🙂 Tu área personal lleva la cuenta de cuánto debería haber.'],
['איך הקופה מגיעה אליי?','How does the box get to me?','¿Cómo me llega la alcancía?'],
['אחרי ההרשמה הכתובת עוברת לשליח באזור, והוא מביא את הקופה עד הבית. את הסטטוס רואים באזור האישי.','After you sign up, your address goes to a courier in your area who brings the box to your home. You can track it in your personal area.','Tras registrarte, tu dirección pasa a un mensajero de tu zona que te lleva la alcancía a casa. El estado lo ves en tu área personal.'],
['מה קורה עם הכסף?','What happens with the money?','¿Qué pasa con el dinero?'],
['לפני ראש השנה אוספים את הקופות (או שמרוקנים אותן בתרומה אונליין מהאזור האישי), וכל הכסף הולך לכרטיסי טיסה לאומן ליהודים שלא זכו להגיע.','Before Rosh Hashanah we collect the boxes (or you empty them with an online donation from your personal area), and all the money goes to flight tickets to Uman for Jews who could not make it.','Antes de Rosh Hashaná recogemos las alcancías (o las vacías con una donación online desde tu área personal), y todo el dinero va a pasajes a Umán para judíos que no pudieron ir.'],
['אפשר לקחת כמה קופות?','Can I take more than one box?','¿Puedo pedir varias alcancías?'],
['בטח – לבית הכנסת, למשרד, לכל אחד מהילדים. כל קופה נרשמת עם מספר טלפון משלה.','Of course – for the shul, the office, each of the kids. Each box is registered with its own phone number.','Claro: para la sinagoga, la oficina, cada uno de los chicos. Cada alcancía se registra con su propio teléfono.'],
['הקופה שלך מחכה','Your box is waiting','Tu alcancía te espera'],
['מחר בבוקר','Tomorrow morning','Mañana por la mañana'],
['מתקרב.','is coming.','se acerca.'],
['הכל מתחיל בשקל. והשקל מתחיל בלחיצה.','It all starts with a shekel. And the shekel starts with a tap.','Todo empieza con un shéquel. Y el shéquel empieza con un toque.'],
['אני רוצה קופה ←','I want a box →','Quiero una alcancía →'],
['כבר יש לי קופה','I already have a box','Ya tengo una alcancía'],
['נ נח נחמ נחמן מאומן · ©','Na Nach Nachma Nachman Me\'Uman · ©','Na Naj Najma Najmán MeUmán · ©'],
['האזור האישי','Personal area','Área personal'],
['וואטסאפ','WhatsApp','WhatsApp'],
['תנאים ופרטיות','Terms & privacy','Términos y privacidad'],
['הצהרת נגישות','Accessibility statement','Declaración de accesibilidad'],
['צילומים: Shoham Avisrur, shraga kopstein, Lex Sirikiat · Unsplash','Photos: Shoham Avisrur, shraga kopstein, Lex Sirikiat · Unsplash','Fotos: Shoham Avisrur, shraga kopstein, Lex Sirikiat · Unsplash'],
['שם פרטי','First name','Nombre'],['שם משפחה','Last name','Apellido'],['טלפון נייד','Mobile phone','Celular'],['מייל','Email','Email'],['(לא חובה)','(optional)','(opcional)'],
['עיר / יישוב','City / town','Ciudad / localidad'],['רחוב','Street','Calle'],['מספר','No.','Número'],['דירה','Apt.','Depto.'],['עיר','City','Ciudad'],
['כמה בכל בוקר?','How much each morning?','¿Cuánto cada mañana?'],['כמה בכל בוקר','How much each morning','Cuánto cada mañana'],
['₪{n} · ח"י','₪{n} · Chai','₪{n} · Jai'],
['מתי?','When?','¿Cuándo?'],['מתי','When','Cuándo'],
['ויברך דוד','At Vayevarech David','En Vaybarej David'],['לפני הנחת תפילין','Before tefillin','Antes de los tefilín'],['אחרי התפילה','After prayers','Después del rezo'],['מתי שנוח לי','Whenever suits me','Cuando me quede cómodo'],
['תזכורת בוקר?','Morning reminder?','¿Recordatorio matutino?'],['שיחה קולית','Voice call','Llamada'],['בלי, תודה','No, thanks','No, gracias'],['באיזו שעה?','At what time?','¿A qué hora?'],
['בחרו קוד אישי (4 ספרות) לכניסה לאזור האישי','Choose a personal code (4 digits) to enter your personal area','Elige un código personal (4 dígitos) para entrar a tu área personal'],
['אפשר להציג את השם הפרטי והעיר שלי באתר ("דוד מצפת לקח קופה")','You may show my first name and city on the site ("David from Safed took a box")','Pueden mostrar mi nombre y ciudad en el sitio ("David de Safed tomó una alcancía")'],
['אני מאשר/ת את','I accept the','Acepto los'],
['התנאים ומדיניות הפרטיות','terms and privacy policy','términos y la política de privacidad'],
['ומסכים/ה לקבל עדכונים ותזכורות','and agree to receive updates and reminders','y acepto recibir novedades y recordatorios'],
['הקופה שלך בדרך. מחר בבוקר – השקל הראשון.','Your box is on its way. Tomorrow morning – the first shekel.','Tu alcancía está en camino. Mañana por la mañana, el primer shéquel.'],
['שיתוף הכרטיס שלי לסטורי 📸','Share my story card 📸','Compartir mi tarjeta en historias 📸'],
['שליחה לחברים בוואטסאפ','Send to friends on WhatsApp','Enviar a amigos por WhatsApp'],
['לאזור האישי ←','To my personal area →','A mi área personal →'],
['המשך ←','Continue →','Continuar →'],
['נגישות','Accessibility','Accesibilidad'],['הגדלת טקסט','Larger text','Texto más grande'],['הקטנת טקסט','Smaller text','Texto más chico'],['ניגודיות גבוהה','High contrast','Alto contraste'],['גווני אפור','Grayscale','Escala de grises'],['הדגשת קישורים','Highlight links','Resaltar enlaces'],['פונט קריא','Readable font','Fuente legible'],['עצירת אנימציות','Stop animations','Detener animaciones'],['הדגשת פוקוס מקלדת','Keyboard focus','Foco de teclado'],['סמן גדול','Big cursor','Cursor grande'],['איפוס','Reset','Restablecer'],['תפריט נגישות','Accessibility menu','Menú de accesibilidad'],['הגדרות נגישות','Accessibility settings','Ajustes de accesibilidad'],
['רבינו שלי','Rabeinu Sheli','Rabeinu Sheli'],
['הנחת תפילין בבית הכנסת','Putting on tefillin in shul','Poniéndose tefilín en la sinagoga'],
['קופת רבינו שלי','Rabeinu Sheli tzedakah box','Alcancía Rabeinu Sheli'],
['מספר קופות','Number of boxes','Cantidad de alcancías'],
['מפת ישראל עם מיקומי הקופות','Map of Israel with box locations','Mapa de Israel con las alcancías'],
['תפילה בכותל','Prayer at the Western Wall','Rezo en el Kotel'],
['סגירה','Close','Cerrar'],['התחילו להקליד…','Start typing…','Empieza a escribir…'],
['ספרה {n}','Digit {n}','Dígito {n}'],
['רבינו שלי · שקל אחד ביום. יהודי אחד אצל רבינו.','Rabeinu Sheli · One shekel a day. One Jew with Rebbe Nachman.','Rabeinu Sheli · Un shéquel al día. Un judío con el Rebe Najmán.'],
['שנה שלמה','A whole year','Un año entero'],['בוקר {n}','Morning {n}','Mañana {n}'],
['× {n} בקרים בשנה','× {n} mornings a year','× {n} mañanas al año'],
['לקח/ה קופה','took a box','tomó una alcancía'],
['קופות כבר ב-','boxes already in','alcancías ya en'],['ערים','cities','ciudades'],
['הקופות הראשונות יוצאות לדרך – היו בין הראשונים','The first boxes are heading out – be among the first','Las primeras alcancías están saliendo: sé de los primeros'],
['כל עיר במפה מחכה לנקודת האור הראשונה שלה. אולי זו תהיה שלך?','Every city on the map is waiting for its first point of light. Maybe it will be yours?','Cada ciudad del mapa espera su primer punto de luz. ¿Será el tuyo?'],
['· לפני {n} דק׳','· {n} min ago','· hace {n} min'],['לפני {n} דק׳','{n} min ago','hace {n} min'],
['· לפני {n} שע׳','· {n} h ago','· hace {n} h'],['לפני {n} שע׳','{n} h ago','hace {n} h'],
['· לפני {n} ימים','· {n} days ago','· hace {n} días'],['לפני {n} ימים','{n} days ago','hace {n} días'],
['הקופה שלי','My box','Mi alcancía'],['הקופה שלי {s}','My box {s}','Mi alcancía {s}'],
['{s}, בקופה שלך כבר','{s}, your box already holds','{s}, tu alcancía ya tiene'],
['· {n} ימים ברצף','· {n}-day streak','· racha de {n} días'],
['השקל של היום כבר בפנים – אשריך!','Today\'s shekel is in – well done!','El shéquel de hoy ya está adentro, ¡bien hecho!'],
['. השקל של היום כבר בפנים – אשריך!','. Today\'s shekel is in – well done!','. El shéquel de hoy ya está adentro, ¡bien hecho!'],
['שמת כבר את השקל של היום?','Did you put in today\'s shekel?','¿Ya pusiste el shéquel de hoy?'],
['. שמת כבר את השקל של היום?','. Did you put in today\'s shekel?','. ¿Ya pusiste el shéquel de hoy?'],
['שמתי את השקל של היום ✓','I put in today\'s shekel ✓','Ya puse el shéquel de hoy ✓'],
['לקופה שלי ←','My box →','Mi alcancía →'],['להזמין חבר 🤝','Invite a friend 🤝','Invitar a un amigo 🤝'],
['הזמנת עד עכשיו','So far you invited','Hasta ahora invitaste a'],['יהודים ·','Jews ·','judíos ·'],['להזמין עוד אחד','invite one more','invitar a uno más'],
['✓ השקל של היום בקופה','✓ Today\'s shekel is in the box','✓ El shéquel de hoy está en la alcancía'],
['השקל של היום בקופה','Today\'s shekel is in the box','El shéquel de hoy está en la alcancía'],
['אשריך! עוד יום ברצף','Well done! Another day in a row','¡Bien hecho! Otro día seguido'],
['להזמין חבר ולהדליק עוד נקודה ←','Invite a friend and light another dot →','Invita a un amigo y enciende otro punto →'],
['להזמין חבר','Invite a friend','Invitar a un amigo'],
['הקופה שלי {s} ←','My box {s} →','Mi alcancía {s} →'],
['נעים להכיר','Nice to meet you','Encantados'],
['איך קוראים לבעל/ת הקופה?','What is the box owner\'s name?','¿Cómo se llama el dueño de la alcancía?'],
['איך נשיג אותך?','How do we reach you?','¿Cómo te contactamos?'],
['הטלפון הוא גם הכניסה לאזור האישי','Your phone is also your login to the personal area','Tu teléfono es también tu acceso al área personal'],
['לאן להביא את הקופה?','Where should we bring the box?','¿Adónde llevamos la alcancía?'],
['השליח שלנו יגיע עד הדלת','Our courier will come to your door','Nuestro mensajero llegará a tu puerta'],
['הקבלה שלך','Your commitment','Tu compromiso'],
['שקל אחד – או כמה שהלב אומר','One shekel – or whatever your heart says','Un shéquel, o lo que te diga el corazón'],
['תזכורת קטנה בבוקר','A small morning reminder','Un pequeño recordatorio matutino'],
['ואחרונה: קוד אישי לאזור שלך','Last one: a personal code for your area','Por último: un código personal para tu área'],
['סיימתי – שלחו לי קופה ✓','Done – send me a box ✓','Listo, envíenme una alcancía ✓'],
['עד ראש השנה:','By Rosh Hashanah:','Hasta Rosh Hashaná:'],['בקופה שלך','in your box','en tu alcancía'],
['בקופה שלך – {n}% מכרטיס טיסה לאומן','in your box – {n}% of a flight ticket to Uman','en tu alcancía: {n}% de un pasaje a Umán'],
['בקופה שלך – כרטיס טיסה שלם לאומן! ✈️','in your box – a full flight ticket to Uman! ✈️','en tu alcancía: ¡un pasaje entero a Umán! ✈️'],
['נא להזין שם פרטי','Please enter a first name','Ingresa tu nombre'],['נא להזין שם משפחה','Please enter a last name','Ingresa tu apellido'],
['נא להזין מספר נייד תקין','Please enter a valid mobile number','Ingresa un celular válido'],['נא להזין מספר נייד ישראלי תקין','Please enter a valid Israeli mobile number','Ingresa un celular israelí válido'],
['כתובת המייל לא תקינה','Invalid email address','Email inválido'],['נא לבחור עיר','Please choose a city','Elige una ciudad'],['נא להזין רחוב','Please enter a street','Ingresa la calle'],['נא להזין מספר בית','Please enter a house number','Ingresa el número'],
['לתזכורת במייל – חזרו שלב אחורה והוסיפו מייל','For email reminders – go back a step and add an email','Para recordatorios por email, vuelve un paso y agrega un email'],
['לתזכורת במייל צריך להזין כתובת מייל','Email reminders need an email address','Para recordatorios por email hace falta un email'],
['נא לבחור קוד אישי של 4 ספרות','Please choose a 4-digit code','Elige un código de 4 dígitos'],['נא לאשר את התנאים','Please accept the terms','Acepta los términos'],
['שולחים…','Sending…','Enviando…'],['קופה #','Box #','Alcancía #'],['קופה #{n}','Box #{n}','Alcancía #{n}'],
['{s}, הקופה שלך בדרך אליך. מחר בבוקר – השקל הראשון. וכל שקל – צעד של עוד יהודי לאומן.','{s}, your box is on its way. Tomorrow morning – the first shekel. And every shekel is a step for another Jew to Uman.','{s}, tu alcancía está en camino. Mañana, el primer shéquel. Y cada shéquel es un paso más de un judío hacia Umán.'],
['אין חיבור כרגע, נסו שוב','No connection right now, try again','Sin conexión, intenta de nuevo'],
['המספר הזה כבר רשום – היכנסו לאזור האישי','This number is already registered – log in to your personal area','Este número ya está registrado: entra a tu área personal'],
['יותר מדי ניסיונות, נסו שוב בעוד כמה דקות','Too many attempts, try again in a few minutes','Demasiados intentos, prueba en unos minutos'],
['כבר יש בקשת איסוף פתוחה – השליח בדרך','There is already an open pickup request – the courier is on the way','Ya hay un pedido de retiro abierto: el mensajero está en camino'],
['מספר הטלפון או הקוד לא נכונים','Wrong phone number or code','Teléfono o código incorrecto'],
['נא להשלים כתובת מלאה – לשם נביא את הקופה','Please complete your full address – that is where we bring the box','Completa tu dirección: allí llevamos la alcancía'],
['קוד אישי: 4–6 ספרות','Personal code: 4–6 digits','Código personal: 4–6 dígitos'],
['כניסה עם הטלפון והקוד האישי','Log in with your phone and personal code','Entra con tu teléfono y código personal'],
['קוד אישי','Personal code','Código personal'],['כניסה ←','Log in →','Entrar →'],['עוד אין לך קופה?','No box yet?','¿Todavía no tienes alcancía?'],['להצטרפות ←','Join →','Sumarme →'],
['שכחת את הקוד? כתבו לנו ונעזור.','Forgot your code? Write to us and we will help.','¿Olvidaste el código? Escríbenos y te ayudamos.'],
['שכחת את הקוד?','Forgot your code?','¿Olvidaste el código?'],['כתבו לנו בוואטסאפ','Message us on WhatsApp','Escríbenos por WhatsApp'],
['בקופה שלך עכשיו','In your box now','En tu alcancía ahora'],['בקרים ברצף','mornings in a row','mañanas seguidas'],['הצטרפו בזכותך','joined thanks to you','se sumaron gracias a ti'],
['ריקון','Empty','Vaciar'],['בתרומה','as donation','donando'],['הזמנת','Book a','Pedir'],['איסוף','pickup','retiro'],['להזמין','Invite','Invitar'],['חבר','a friend','a un amigo'],
['כרטיס','Story','Tarjeta'],['לסטורי','card','para historias'],['תזכורת','Reminder','Recordatorio'],['בוקר','Morning','Mañana'],['כתובת','Address','Dirección'],['ופרטים','& details','y datos'],
['הקופה הפיזית שלך','Your physical box','Tu alcancía física'],['נרשמת','Signed up','Registrado'],['שובצה','Assigned','Asignada'],['בדרך','On the way','En camino'],['אצלך','With you','Contigo'],
['{n} הימים האחרונים','Last {n} days','Últimos {n} días'],
['ריקון הקופה','Empty the box','Vaciar la alcancía'],['הקופה מלאה, או שיש לך כוונה מיוחדת? בחר איך.','Box full, or have a special intention? Choose how.','¿Alcancía llena o una intención especial? Elige cómo.'],
['תרומה מכוונת','Dedicated donation','Donación con intención'],['מרוקנים אונליין, עם כוונה – לרפואה, לזיווג, לפרנסה…','Empty it online with an intention – for healing, a match, livelihood…','Vacíala online con una intención: salud, pareja, sustento…'],
['הזמנת איסוף','Book a pickup','Pedir retiro'],['שליח מגיע אליך ולוקח את הכסף מהקופה','A courier comes and collects the money from the box','Un mensajero pasa y retira el dinero de la alcancía'],
['היסטוריה','History','Historial'],['תזכורת בוקר','Morning reminder','Recordatorio matutino'],['מתי ואיך להזכיר לך לשים את השקל.','When and how to remind you to put in the shekel.','Cuándo y cómo recordarte poner el shéquel.'],
['שיחה','Call','Llamada'],['בלי','None','Ninguno'],['שעה','Time','Hora'],['באילו ימים','Which days','Qué días'],
['א׳','Su','Do'],['ב׳','Mo','Lu'],['ג׳','Tu','Ma'],['ד׳','We','Mi'],['ה׳','Th','Ju'],['ו׳','Fr','Vi'],
['שמירת התזכורת','Save reminder','Guardar recordatorio'],['כתובת ופרטים','Address & details','Dirección y datos'],['הקבלה שלי','My commitment','Mi compromiso'],['להזמין חברים','Invite friends','Invitar amigos'],
['כרטיס לסטורי','Story card','Tarjeta para historias'],['תמונה מעוצבת עם מספר הקופה שלך','A designed image with your box number','Una imagen con el número de tu alcancía'],
['עזרה בוואטסאפ','Help on WhatsApp','Ayuda por WhatsApp'],['אנחנו כאן','We are here','Estamos aquí'],['יציאה','Log out','Salir'],['אני','Me','Yo'],
['הקופה שלי · רבינו שלי','My box · Rabeinu Sheli','Mi alcancía · Rabeinu Sheli'],['שגיאה','Error','Error'],
['בוקר טוב, {s}','Good morning, {s}','Buenos días, {s}'],['צהריים טובים, {s}','Good afternoon, {s}','Buenas tardes, {s}'],['ערב טוב, {s}','Good evening, {s}','Buenas noches, {s}'],
['הבוקר הראשון עם רבינו · ₪{n} ליום','First morning with Rebbe Nachman · ₪{n} a day','Primera mañana con el Rebe Najmán · ₪{n} al día'],
['{n} בקרים עם רבינו · ₪{n} ליום','{n} mornings with Rebbe Nachman · ₪{n} a day','{n} mañanas con el Rebe Najmán · ₪{n} al día'],
['בוקר אחד × ₪{n}','One morning × ₪{n}','Una mañana × ₪{n}'],['{n} בקרים × ₪{n}','{n} mornings × ₪{n}','{n} mañanas × ₪{n}'],
['🕯 שבת שלום – היום לא סופרים','🕯 Shabbat Shalom','🕯 Shabat Shalom'],['🕯 {s} – חג שמח','🕯 {s} – Chag Sameach','🕯 {s} – Jag Saméaj'],
['בהכנה','Being prepared','En preparación'],['שובצה לשליח','Assigned to courier','Asignada a mensajero'],['בדרך אליך','On its way to you','En camino a ti'],['אצלך ✓','With you ✓','Contigo ✓'],
['ש','S','S'],['ח','H','F'],['שבת','Shabbat','Shabat'],
['קופה #{n} · {n}','Box #{n} · {n}','Alcancía #{n} · {n}'],['₪{n} ליום · {s}','₪{n} a day · {s}','₪{n} al día · {s}'],
['כבר {n} הצטרפו בזכותך','{n} already joined thanks to you','{n} ya se sumaron gracias a ti'],['כל הזמנה מדליקה נקודה במפה','Every invite lights a dot on the map','Cada invitación enciende un punto en el mapa'],
['התקבלה','Received','Recibido'],['נקבע מועד','Scheduled','Programado'],['נאסף ✓','Collected ✓','Retirado ✓'],['בוטל','Cancelled','Cancelado'],['ממתין לתשלום','Awaiting payment','Esperando pago'],['בבדיקה','Under review','En revisión'],['התקבל ✓','Received ✓','Recibido ✓'],
['🚚 איסוף','🚚 Pickup','🚚 Retiro'],['✨ תרומה','✨ Donation','✨ Donación'],['🚚 איסוף · {s}','🚚 Pickup · {s}','🚚 Retiro · {s}'],['✨ תרומה · {s}','✨ Donation · {s}','✨ Donación · {s}'],
['עוד לא רוקנת – הקופה מתמלאת 🙂','Not emptied yet – the box is filling up 🙂','Todavía no la vaciaste: se está llenando 🙂'],
['אשריך! עוד בוקר ברצף','Well done! Another morning in a row','¡Bien hecho! Otra mañana seguida'],['בחר איך להזכיר','Choose how to remind you','Elige cómo recordarte'],['התזכורת נשמרה ✓','Reminder saved ✓','Recordatorio guardado ✓'],
['ריקון בתרומה מכוונת','Empty as a dedicated donation','Vaciar como donación con intención'],['הכסף מצטרף לכרטיסים לאומן. עם איזו כוונה?','The money joins the tickets to Uman. With what intention?','El dinero se suma a los pasajes a Umán. ¿Con qué intención?'],
['לרפואה שלמה','For a full recovery','Por una pronta curación'],['לזיווג הגון','For a good match','Por una buena pareja'],['לפרנסה טובה','For good livelihood','Por un buen sustento'],['לעילוי נשמת','In memory of','En memoria de'],['להצלחה','For success','Por el éxito'],['לשלום בית','For peace at home','Por la paz en el hogar'],
['על שם (לא חובה)','In the name of (optional)','A nombre de (opcional)'],['לדוגמה: יוסף בן שרה','e.g. Yosef ben Sarah','ej.: Yosef ben Sara'],['סכום (₪)','Amount (₪)','Monto (₪)'],['להמשך לתשלום ←','Continue to payment →','Continuar al pago →'],
['אחרי התשלום','After payment','Después del pago'],['סיימת לשלם? אשר כאן והקופה תתאפס.','Finished paying? Confirm here and the box resets.','¿Terminaste de pagar? Confirma aquí y la alcancía se reinicia.'],['שילמתי ✓','I paid ✓','Ya pagué ✓'],['עוד לא','Not yet','Todavía no'],
['תזכה למצוות!','May you merit more mitzvot!','¡Que tengas el mérito de más mitzvot!'],['הבקשה נרשמה','Request received','Pedido registrado'],['התשלום אונליין עוד לא פתוח – נחזור אליך עם קישור. תודה!','Online payment is not open yet – we will get back to you with a link. Thank you!','El pago online todavía no está habilitado: te enviaremos un enlace. ¡Gracias!'],
['שליח יגיע אל {s}','A courier will come to {s}','Un mensajero irá a {s}'],['בקופה כרגע כ-₪{n}','About ₪{n} in the box now','Hay unos ₪{n} en la alcancía'],
['צהריים','Noon','Mediodía'],['ערב','Evening','Tarde'],['מוצאי שבת','Saturday night','Sábado a la noche'],['הערה לשליח','Note for the courier','Nota para el mensajero'],['קומה, קוד כניסה…','Floor, entry code…','Piso, código de entrada…'],['שלחו שליח ←','Send a courier →','Envíen un mensajero →'],
['השליח בדרך','The courier is on the way','El mensajero está en camino'],['נתאם איתך בטלפון. תודה שאתה חלק מהאור!','We will coordinate by phone. Thank you for being part of the light!','Coordinamos por teléfono. ¡Gracias por ser parte de la luz!'],
['כל מי שמצטרף דרכך נספר לזכותך – כבר {n}!','Everyone who joins through you counts for you – already {n}!','Cada uno que se suma por ti cuenta a tu favor: ¡ya {n}!'],['כל מי שמצטרף דרכך נספר לזכותך – הראשון מחכה','Everyone who joins through you counts for you – the first one is waiting','Cada uno que se suma por ti cuenta a tu favor: el primero te espera'],
['שיתוף ←','Share →','Compartir →'],['העתקה','Copy','Copiar'],['הקישור הועתק','Link copied','Enlace copiado'],
['תמונה מעוצבת עם הקופה ומספר הקופה שלך – מוכנה לאינסטגרם ולסטטוס.','A designed image with the box and your box number – ready for Instagram and status.','Una imagen con la alcancía y su número, lista para Instagram y estados.'],['יצירה ושיתוף 📸','Create & share 📸','Crear y compartir 📸'],
['להציג את השם הפרטי והעיר שלי באתר','Show my first name and city on the site','Mostrar mi nombre y ciudad en el sitio'],['שמירה','Save','Guardar'],['נשמר ✓','Saved ✓','Guardado ✓'],
['נ נח נחמ נחמן מאומן','Na Nach Nachma Nachman Me\'Uman','Na Naj Najma Najmán MeUmán'],
['רוצים קופה משלכם?','Want a box of your own?','¿Quieres tu propia alcancía?'],['סרקו את הקוד · שקל אחד ביום','Scan the code · one shekel a day','Escanea el código · un shéquel al día'],
['שקל אחד ביום','One shekel a day','Un shéquel al día'],
['{n} בקרים ברצף · בזכותי עוד יהודי באומן','{n} mornings in a row · thanks to me another Jew in Uman','{n} mañanas seguidas · gracias a mí otro judío en Umán'],
['בזכותי עוד יהודי באומן','Thanks to me, another Jew in Uman','Gracias a mí, otro judío en Umán'],
['{n} קופות','{n} boxes','{n} alcancías'],['{s} · {n} קופות','{s} · {n} boxes','{s} · {n} alcancías'],
// terms
['תנאים ופרטיות · רבינו שלי','Terms & privacy · Rabeinu Sheli','Términos y privacidad · Rabeinu Sheli'],
['תנאים ומדיניות פרטיות','Terms and privacy policy','Términos y política de privacidad'],
['המיזם "רבינו שלי" הוא מיזם התנדבותי לחלוקת קופות צדקה. המשתתפים מקבלים על עצמם, כקבלה טובה ולא כהתחייבות משפטית, לשים סכום קטן בקופה מדי יום. הכספים שנאספים מיועדים למימון נסיעות לאומן בראש השנה עבור מי שלא זכו להגיע. ניתן להפסיק את ההשתתפות בכל עת.','"Rabeinu Sheli" is a volunteer initiative distributing tzedakah boxes. Participants take upon themselves – as a good resolution, not a legal obligation – to put a small sum in the box every day. The funds collected finance trips to Uman for Rosh Hashanah for those who could not go. You may stop participating at any time.','"Rabeinu Sheli" es una iniciativa voluntaria que reparte alcancías de tzedaká. Los participantes asumen, como buena resolución y no como obligación legal, poner una pequeña suma cada día. Lo recaudado financia viajes a Umán en Rosh Hashaná para quienes no pudieron ir. Puedes dejar de participar en cualquier momento.'],
['איסוף הכסף ותרומות','Collection and donations','Recolección y donaciones'],
['הכסף נאסף על ידי שליחי המיזם או באמצעות תרומה מקוונת דרך ספק סליקה חיצוני. הסכומים המוצגים באזור האישי הם הערכה לפי מספר הימים והסכום שבחרתם, ואינם משקפים את הכסף שבקופה בפועל.','Money is collected by the initiative\'s couriers or via online donation through an external payment provider. Amounts shown in the personal area are estimates based on the number of days and the amount you chose, and do not reflect the actual money in the box.','El dinero lo recogen mensajeros de la iniciativa o se dona online a través de un procesador de pagos externo. Los montos del área personal son estimaciones según los días y el monto elegido, y no reflejan el dinero real de la alcancía.'],
['איזה מידע אנחנו שומרים','What information we keep','Qué información guardamos'],
['שם, טלפון, מייל וכתובת – לצורך משלוח הקופה, איסוף ותזכורות.','Name, phone, email and address – for box delivery, pickup and reminders.','Nombre, teléfono, email y dirección: para el envío, el retiro y los recordatorios.'],
['העדפות תזכורת וסימוני "שמתי היום".','Reminder preferences and "I gave today" check-ins.','Preferencias de recordatorio y marcas de "Ya puse hoy".'],
['שם פרטי ועיר עשויים להופיע באתר רק אם אישרתם זאת. ניתן לבטל באזור האישי.','First name and city may appear on the site only if you agreed. You can cancel in the personal area.','Nombre y ciudad pueden aparecer en el sitio solo si lo aceptaste. Puedes cancelarlo en el área personal.'],
['שימוש במידע','Use of information','Uso de la información'],
['המידע משמש רק להפעלת המיזם: משלוח ואיסוף קופות, תזכורות שביקשתם ועדכונים על המיזם. הכתובות מועברות לשליחי המיזם לצורך המשלוח בלבד. לא נמכור ולא נעביר את המידע לצדדים שלישיים למטרות אחרות. ניתן לבקש עיון, תיקון או מחיקה של המידע בפנייה אלינו.','Information is used only to run the initiative: delivering and collecting boxes, reminders you asked for and updates about the initiative. Addresses are passed to our couriers for delivery only. We will not sell or pass the information to third parties for other purposes. You may request to view, correct or delete your information by contacting us.','La información se usa solo para operar la iniciativa: envío y retiro de alcancías, recordatorios pedidos y novedades. Las direcciones se pasan a los mensajeros solo para el envío. No venderemos ni cederemos la información a terceros para otros fines. Puedes pedir ver, corregir o borrar tus datos contactándonos.'],
['תזכורות','Reminders','Recordatorios'],
['תזכורות נשלחות רק בערוץ ובשעה שבחרתם, וניתן לשנות או לבטל אותן בכל רגע מהאזור האישי.','Reminders are sent only on the channel and at the time you chose, and can be changed or cancelled anytime from the personal area.','Los recordatorios se envían solo por el canal y a la hora elegidos, y puedes cambiarlos o cancelarlos desde el área personal.'],
['אחריות','Liability','Responsabilidad'],
['המיזם פועל בתום לב ואינו אחראי לתקלות טכניות, לעיכובים במשלוח או לנזק עקיף. השימוש באתר מהווה הסכמה לתנאים אלה.','The initiative acts in good faith and is not responsible for technical faults, delivery delays or indirect damage. Using the site constitutes acceptance of these terms.','La iniciativa actúa de buena fe y no se responsabiliza por fallas técnicas, demoras en el envío o daños indirectos. Usar el sitio implica aceptar estos términos.'],
['← חזרה לאתר','← Back to site','← Volver al sitio'],['חזרה לאתר','Back to site','Volver al sitio'],
// accessibility
['הצהרת נגישות · רבינו שלי','Accessibility statement · Rabeinu Sheli','Declaración de accesibilidad · Rabeinu Sheli'],
['אנו רואים חשיבות רבה במתן שירות שוויוני לכל המשתמשים, ופועלים כדי שהאתר יהיה נגיש לאנשים עם מוגבלות, בהתאם לחוק שוויון זכויות לאנשים עם מוגבלות, התשנ"ח-1998, ולתקנות שוויון זכויות לאנשים עם מוגבלות (התאמות נגישות לשירות), התשע"ג-2013.','We consider equal service for all users very important, and work to make the site accessible to people with disabilities, in accordance with Israel\'s Equal Rights for Persons with Disabilities Law, 1998, and the Accessibility Regulations for Services, 2013.','Damos gran importancia a un servicio igualitario para todos y trabajamos para que el sitio sea accesible a personas con discapacidad, según la Ley israelí de Igualdad de Derechos de las Personas con Discapacidad (1998) y sus Reglamentos de Accesibilidad (2013).'],
['רמת הנגישות','Accessibility level','Nivel de accesibilidad'],
['האתר הותאם לדרישות תקן ישראלי ת"י {n} (המבוסס על הנחיות WCAG {n}) ברמה AA, ונבדק בדפדפנים הנפוצים (Chrome, Safari, Edge, Firefox) במחשב ובנייד.','The site was adapted to Israeli Standard IS {n} (based on WCAG {n}) at level AA, and tested in common browsers (Chrome, Safari, Edge, Firefox) on desktop and mobile.','El sitio se adaptó a la norma israelí IS {n} (basada en WCAG {n}) nivel AA, y se probó en los navegadores comunes (Chrome, Safari, Edge, Firefox) en computadora y celular.'],
['מה עשינו באתר','What we did','Qué hicimos'],
['תפריט נגישות זמין בכל עמוד (הכפתור העגול בפינת המסך): הגדלה והקטנה של טקסט, ניגודיות גבוהה, גווני אפור, הדגשת קישורים, פונט קריא, עצירת אנימציות, הדגשת פוקוס וסמן עכבר גדול.','An accessibility menu on every page (the round button in the corner): larger/smaller text, high contrast, grayscale, link highlighting, readable font, stopping animations, focus highlighting and a large cursor.','Un menú de accesibilidad en cada página (el botón redondo en la esquina): texto más grande o chico, alto contraste, escala de grises, resaltar enlaces, fuente legible, detener animaciones, foco visible y cursor grande.'],
['ניווט מלא במקלדת, כולל קישור "דלגו לתוכן הראשי" וסימון פוקוס ברור.','Full keyboard navigation, including a "Skip to main content" link and clear focus marking.','Navegación completa con teclado, con enlace "Saltar al contenido principal" y foco claro.'],
['טקסט חלופי לתמונות ותוויות לטפסים ולכפתורים.','Alt text for images and labels for forms and buttons.','Texto alternativo en imágenes y etiquetas en formularios y botones.'],
['מבנה כותרות היררכי ושפת עמוד מוגדרת (עברית, מימין לשמאל).','Hierarchical headings and a defined page language.','Encabezados jerárquicos e idioma de página definido.'],
['כיבוד הגדרת המערכת "הפחתת תנועה" – האנימציות נעצרות אוטומטית.','Respecting the system "reduce motion" setting – animations stop automatically.','Se respeta el ajuste "reducir movimiento": las animaciones se detienen solas.'],
['ניגודיות צבעים מספקת לטקסט, ותצוגה מותאמת לכל גודל מסך.','Sufficient color contrast for text, and a layout adapted to every screen size.','Contraste suficiente para el texto y diseño adaptado a cualquier pantalla.'],
['מגבלות ידועות','Known limitations','Limitaciones conocidas'],
['ייתכן שחלקים מסוימים, כגון מפת ישראל האינטראקטיבית, תמונות או תכנים של צדדים שלישיים (למשל דף התשלום של ספק הסליקה), אינם נגישים במלואם. אנו ממשיכים לשפר את הנגישות באופן שוטף. המידע שבמפה מוצג גם בטקסט שלצידה.','Some parts, such as the interactive map of Israel, images or third-party content (e.g. the payment provider\'s page), may not be fully accessible. We keep improving accessibility. The map information is also shown in the text next to it.','Algunas partes, como el mapa interactivo, imágenes o contenido de terceros (p. ej. la página del procesador de pagos), pueden no ser totalmente accesibles. Seguimos mejorando. La información del mapa también aparece en el texto junto a él.'],
['נתקלתם בבעיה? דברו איתנו','Found a problem? Talk to us','¿Encontraste un problema? Escríbenos'],
['אם נתקלתם בקושי בגלישה או בהרשמה, נשמח לעזור ולתקן. אפשר לפנות לרכז/ת הנגישות של המיזם','If you had difficulty browsing or signing up, we will gladly help and fix it. You can contact the initiative\'s accessibility coordinator','Si tuviste dificultades para navegar o registrarte, con gusto te ayudamos. Puedes contactar al coordinador de accesibilidad'],
['. אנו משתדלים להשיב תוך {n} ימי עסקים. בפנייה כדאי לציין את העמוד, תיאור הבעיה וסוג הדפדפן והמכשיר.','. We try to reply within {n} business days. Please mention the page, a description of the problem and your browser and device.','. Intentamos responder en {n} días hábiles. Indica la página, el problema y tu navegador y dispositivo.'],
['ניתן גם להירשם לקופה בטלפון, בעזרת נציג, במקום דרך האתר.','You can also sign up for a box by phone with a representative instead of on the site.','También puedes pedir una alcancía por teléfono con un representante.'],
['עדכון אחרון: נובמבר {n}','Last updated: November {n}','Última actualización: noviembre de {n}'],
['מ-₪{n}','from ₪{n}','desde ₪{n}'],['ריקון ואיסוף אפשריים מ-₪{n} בקופה','Emptying and pickup are available from ₪{n} in the box','Vaciar y retirar es posible desde ₪{n} en la alcancía'],
['בקופה ₪{n} · עוד ₪{n} – בערך {n} בקרים','₪{n} in the box · ₪{n} to go – about {n} mornings','₪{n} en la alcancía · faltan ₪{n}, unas {n} mañanas'],['הבנתי','Got it','Entendido'],
['איסוף אפשרי מ-₪{n} בקופה','Pickup is available from ₪{n} in the box','El retiro es posible desde ₪{n}'],['ריקון אפשרי מ-₪{n}','Emptying is available from ₪{n}','Vaciar es posible desde ₪{n}'],
['כרטיס לסטורי','Story card','Tarjeta para historias'],['כל בוקר. שקל אחד.','Every morning. One shekel.','Cada mañana. Un shéquel.'],['✈️ אומן','✈️ Uman','✈️ Umán'],
['כל נקודה במפה היא קופה, שקל בכל בוקר ויהודי אחד שמתקרב.','Every dot on the map is a box – a shekel every morning and one more Jew getting closer.','Cada punto del mapa es una alcancía: un shéquel cada mañana y un judío más cerca.'],
['רבי נחמן מברסלב','Rebbe Nachman of Breslov','Rebe Najmán de Breslov'],['המיזם','The initiative','La iniciativa'],
['"רבינו שלי" הוא מיזם התנדבותי לחלוקת קופות צדקה. המשתתפים מקבלים על עצמם, כקבלה טובה ולא כהתחייבות משפטית, לשים סכום קטן בקופה מדי יום. הכספים שנאספים מיועדים למימון נסיעות לאומן בראש השנה עבור מי שלא זכו להגיע. ניתן להפסיק את ההשתתפות בכל עת.','"Rabeinu Sheli" is a volunteer initiative distributing tzedakah boxes. Participants take upon themselves – as a good resolution, not a legal obligation – to put a small sum in the box every day. The funds collected finance trips to Uman for Rosh Hashanah for those who could not go. You may stop participating at any time.','"Rabeinu Sheli" es una iniciativa voluntaria que reparte alcancías de tzedaká. Los participantes asumen, como buena resolución y no como obligación legal, poner una pequeña suma cada día. Lo recaudado financia viajes a Umán en Rosh Hashaná para quienes no pudieron ir. Puedes dejar de participar en cualquier momento.'],
['בוואטסאפ:','on WhatsApp:','por WhatsApp:'],['בוואטסאפ: {s}','on WhatsApp: {s}','por WhatsApp: {s}']
  ];
  // Israeli localities (en = es)
  var C = 'ירושלים:Jerusalem|בית שמש:Beit Shemesh|מבשרת ציון:Mevaseret Zion|קריית יערים:Kiryat Ye\'arim|צור הדסה:Tzur Hadassah|אבו גוש:Abu Ghosh|תל אביב-יפו:Tel Aviv-Jaffa|בני ברק:Bnei Brak|רמת גן:Ramat Gan|גבעתיים:Givatayim|חולון:Holon|בת ים:Bat Yam|הרצליה:Herzliya|רמת השרון:Ramat HaSharon|קריית אונו:Kiryat Ono|אור יהודה:Or Yehuda|יהוד-מונוסון:Yehud-Monosson|גבעת שמואל:Givat Shmuel|פתח תקווה:Petah Tikva|ראשון לציון:Rishon LeZion|רחובות:Rehovot|נתניה:Netanya|כפר סבא:Kfar Saba|רעננה:Ra\'anana|הוד השרון:Hod HaSharon|ראש העין:Rosh HaAyin|אלעד:Elad|מודיעין:Modi\'in|לוד:Lod|רמלה:Ramla|נס ציונה:Ness Ziona|יבנה:Yavne|באר יעקב:Be\'er Ya\'akov|שוהם:Shoham|גדרה:Gedera|מזכרת בתיה:Mazkeret Batya|קריית עקרון:Kiryat Ekron|כפר יונה:Kfar Yona|אבן יהודה:Even Yehuda|כפר חב"ד:Kfar Chabad|גני תקווה:Ganei Tikva|אורנית:Oranit|חיפה:Haifa|קריית אתא:Kiryat Ata|קריית ביאליק:Kiryat Bialik|קריית מוצקין:Kiryat Motzkin|קריית ים:Kiryat Yam|טירת כרמל:Tirat Carmel|נשר:Nesher|חדרה:Hadera|זכרון יעקב:Zichron Ya\'akov|אור עקיבא:Or Akiva|פרדס חנה-כרכור:Pardes Hanna-Karkur|חריש:Harish|רכסים:Rechasim|קריית טבעון:Kiryat Tivon|עתלית:Atlit|בנימינה:Binyamina|צפת:Safed|טבריה:Tiberias|מירון:Meron|נוף הגליל:Nof HaGalil|עפולה:Afula|כרמיאל:Karmiel|עכו:Acre|נהריה:Nahariya|מעלות-תרשיחא:Ma\'alot-Tarshiha|שלומי:Shlomi|קריית שמונה:Kiryat Shmona|חצור הגלילית:Hatzor HaGlilit|ראש פינה:Rosh Pina|קצרין:Katzrin|מגדל העמק:Migdal HaEmek|בית שאן:Beit She\'an|יקנעם:Yokneam|מטולה:Metula|יסוד המעלה:Yesud HaMa\'ala|כפר תבור:Kfar Tavor|באר שבע:Be\'er Sheva|אשדוד:Ashdod|אשקלון:Ashkelon|קריית גת:Kiryat Gat|קריית מלאכי:Kiryat Malachi|נתיבות:Netivot|שדרות:Sderot|אופקים:Ofakim|דימונה:Dimona|ערד:Arad|ירוחם:Yeruham|מצפה רמון:Mitzpe Ramon|אילת:Eilat|גן יבנה:Gan Yavne|להבים:Lehavim|עומר:Omer|מיתר:Meitar|ביתר עילית:Beitar Illit|מודיעין עילית:Modi\'in Illit|מעלה אדומים:Ma\'ale Adumim|אפרת:Efrat|גבעת זאב:Givat Ze\'ev|אריאל:Ariel|עמנואל:Emmanuel|קרני שומרון:Karnei Shomron|אלקנה:Elkana|בית אל:Beit El|קדומים:Kedumim|קריית ארבע:Kiryat Arba|תקוע:Tekoa|כוכב יעקב:Kochav Ya\'akov|אלון שבות:Alon Shvut|יצהר:Yitzhar|שילה:Shilo|אחר:Other';
  var CITY = {}; C.split('|').forEach(function (p) { var a = p.split(':'); CITY[a[0]] = a[1]; });

  var HE = /[֐-׿]/, NUM = /\d[\d,.]*/g;
  var norm = function (s) { return s.replace(/\s+/g, ' ').trim(); };
  var EX = {}, RX = [];
  var esc = function (s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };
  D.forEach(function (r) {
    var k = norm(r[0]), v = r[I];
    if (k.indexOf('{s}') < 0) { EX[k] = v; return; }
    var re = '^' + esc(k).replace(/\\\{n\\\}/g, '(\\d[\\d,.]*)').replace(/\\\{s\\\}/g, '(.+?)') + '$';
    var order = []; k.replace(/\{(n|s)\}/g, function (m, t) { order.push(t); });
    RX.push([new RegExp(re), v, order]);
  });
  var fill = function (v, vals) { var i = 0; return v.replace(/\{(n|s)\}/g, function () { var x = vals[i++]; return x == null ? '' : x; }); };
  var city = function (s) { return CITY[s] || s; };
  var cityRe = new RegExp('^(.+?) מ(' + Object.keys(CITY).map(esc).join('|') + ')$');
  var FROM = I === 1 ? ' from ' : ' de ';
  function tr(s) {
    var k = norm(s); if (!k || !HE.test(k)) return null;
    if (EX[k] != null) return EX[k];
    var q = k.match(/^(["“”])(.+)(["“”])$/); if (q) { var qi = tr(q[2]); if (qi != null) return '"' + qi + '"'; }
    var nums = k.match(NUM) || [], kn = k.replace(NUM, '{n}');
    if (EX[kn] != null) return fill(EX[kn], nums);
    if (CITY[k]) return CITY[k];
    var m = k.match(cityRe); if (m) return m[1] + FROM + city(m[2]);
    for (var i = 0; i < RX.length; i++) { var mm = k.match(RX[i][0]); if (mm) { var vals = mm.slice(1).map(function (x, j) { var t = tr(x); return t != null ? t : city(x); }); return fill(RX[i][1], vals); } }
    // "street 5, city"  → translate city part
    var c = k.match(/^(.*), ([^,]+)$/); if (c && CITY[c[2]]) return c[1] + ', ' + CITY[c[2]];
    var p = k.match(/^(.+) · ([^·]+)$/); if (p) { var a = tr(p[1]), b = tr(p[2]); if (a != null || b != null) return (a != null ? a : city(p[1])) + ' · ' + (b != null ? b : city(p[2])); }
    return null;
  }
  window.T = function (s) { if (L === 'he') return s; var t = tr(s); return t == null ? s : t; };
  window.T.city = function (s) { return L === 'he' ? s : city(s); };
  window.T.missing = [];
  if (L === 'he') { window.T.ready = true; return; }

  var st = document.createElement('style'); st.textContent = 'html:not(.tr-ok) body{opacity:0}body{transition:opacity .25s}';
  document.head.appendChild(st); setTimeout(function () { H.classList.add('tr-ok'); }, 1800);
  var ATT = ['placeholder', 'aria-label', 'title', 'alt'];
  function node(n) {
    if (n.nodeType === 3) {
      var v = n.nodeValue; if (!HE.test(v)) return; var p = n.parentElement; if (p && /^(SCRIPT|STYLE|OPTION)$/.test(p.tagName)) return;
      if (p && p.closest('[data-notr],.kb')) return;
      var t = tr(v); if (t != null) { var lead = v.match(/^\s*/)[0], trail = v.match(/\s*$/)[0]; n.nodeValue = lead + t + trail; }
      else if (window.T.missing.indexOf(norm(v)) < 0) window.T.missing.push(norm(v));
    } else if (n.nodeType === 1) {
      if (/^(SCRIPT|STYLE)$/.test(n.tagName) || n.hasAttribute('data-notr')) return;
      for (var a = 0; a < ATT.length; a++) { var x = n.getAttribute(ATT[a]); if (x && HE.test(x)) { var y = tr(x); if (y != null) n.setAttribute(ATT[a], y); } }
      for (var c = n.firstChild; c; c = c.nextSibling) node(c);
    }
  }
  var busy = false;
  function all() { busy = true; node(document.body); var t = tr(document.title); if (t) document.title = t; busy = false; }
  var mo = new MutationObserver(function (ms) {
    if (busy) return; busy = true;
    ms.forEach(function (m) {
      if (m.type === 'characterData') node(m.target);
      else if (m.type === 'attributes') node(m.target);
      else m.addedNodes.forEach(node);
    });
    busy = false;
  });
  document.addEventListener('DOMContentLoaded', function () {
    all(); H.classList.add('tr-ok');
    mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATT });
  });
})();

/* tiny language switch – renders into [data-lang] or as a small corner chip */
(function () {
  function build() {
    var L = window.RB_LANG, host = document.querySelector('[data-lang]');
    var css = document.createElement('style');
    css.textContent = '.lsw{position:relative;display:inline-flex;font:600 12px/1 Fredoka,Heebo,sans-serif;letter-spacing:.04em;z-index:60}' +
      '.lsw>button{display:inline-flex;align-items:center;gap:5px;height:30px;padding:0 10px;border-radius:99px;border:1px solid rgba(217,174,91,.28);background:rgba(9,13,32,.35);color:#e9cf98;cursor:pointer}' +
      '.lsw>button svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.6}' +
      '.lsw ul{position:absolute;top:36px;inset-inline-end:0;list-style:none;margin:0;padding:5px;border-radius:14px;border:1px solid rgba(217,174,91,.28);background:rgba(11,16,38,.96);backdrop-filter:blur(12px);display:none;min-width:116px;box-shadow:0 12px 30px rgba(0,0,0,.4)}' +
      '.lsw.on ul{display:block}.lsw li a{display:flex;justify-content:space-between;gap:12px;padding:9px 11px;border-radius:9px;color:#f6efe0;text-decoration:none;font-size:14px;font-weight:500}.lsw li a:hover,.lsw li a[aria-current]{background:rgba(217,174,91,.12);color:#e9cf98}.lsw li a b{opacity:.55;font-weight:600;font-size:11px}' +
      '.lsw.fx{position:fixed;top:12px;inset-inline-end:12px}';
    document.head.appendChild(css);
    var w = document.createElement('div'); w.className = 'lsw' + (host ? '' : ' fx'); w.setAttribute('data-notr', '');
    var N = { he: 'עברית', en: 'English', es: 'Español' }, S = { he: 'עב', en: 'EN', es: 'ES' };
    w.innerHTML = '<button type="button" aria-haspopup="true" aria-expanded="false" aria-label="Language / שפה"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.8 2.6 15.2 0 18M12 3c-2.6 2.8-2.6 15.2 0 18"/></svg>' + S[L] + '</button><ul>' +
      ['he', 'en', 'es'].map(function (k) { return '<li><a href="#" lang="' + k + '" data-l="' + k + '"' + (k === L ? ' aria-current="true"' : '') + '>' + N[k] + '<b>' + S[k] + '</b></a></li>'; }).join('') + '</ul>';
    (host || document.body).appendChild(w);
    var b = w.querySelector('button');
    b.onclick = function (e) { e.stopPropagation(); var o = w.classList.toggle('on'); b.setAttribute('aria-expanded', o); };
    document.addEventListener('click', function () { w.classList.remove('on'); b.setAttribute('aria-expanded', 'false'); });
    w.querySelectorAll('[data-l]').forEach(function (a) {
      a.onclick = function (e) {
        e.preventDefault(); var k = a.getAttribute('data-l'); try { localStorage.setItem('rb-lang', k); } catch (x) {}
        var u = new URL(location.href); u.searchParams.delete('lang'); if (k !== 'he') u.searchParams.set('lang', k); location.href = u.toString();
      };
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
