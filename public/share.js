// Story card 1080x1920 – Bona Nova headline, the box, personal number + QR to join
window.rbCard=async function({boxNo,ref,streak,first,url}){
  const t=s=>window.T?T(s):s,he=(window.RB_LANG||'he')==='he';
  const fit=(txt,w,font)=>{let sz=+font.match(/(\d+)px/)[1];x.font=font;while(x.measureText(txt).width>w&&sz>20){sz-=4;x.font=font.replace(/\d+px/,sz+'px')}};
  const W=1080,H=1920,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
  const load=s=>new Promise(ok=>{const i=new Image();i.onload=()=>ok(i);i.onerror=()=>ok(null);i.src=s});
  try{await Promise.all([document.fonts.load('200 120px Heebo'),document.fonts.load('800 120px Heebo'),document.fonts.load('700 120px "Bona Nova"'),document.fonts.load('500 40px Fredoka'),document.fonts.load('600 40px Fredoka')])}catch{}
  const link=url||location.origin+'/r/'+ref+(window.RB_LQ||'');
  const [st,bx,qr]=await Promise.all([load('/stone.jpg'),load('/box.png'),load('/api/qr?c=141c4a&d='+encodeURIComponent(link))]);
  x.fillStyle=st?x.createPattern(st,'repeat'):'#0e1430';x.fillRect(0,0,W,H);
  let g=x.createRadialGradient(540,980,120,540,980,1250);g.addColorStop(0,'rgba(217,174,91,.10)');g.addColorStop(.45,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.6)');x.fillStyle=g;x.fillRect(0,0,W,H);
  x.strokeStyle='rgba(212,176,106,.55)';x.lineWidth=2;x.strokeRect(40,40,W-80,H-80);
  // arch behind the box (the tziyun)
  const arch=(w,top,bot,lw,a)=>{x.beginPath();x.moveTo(540-w/2,bot);x.lineTo(540-w/2,top+w/2);x.arc(540,top+w/2,w/2,Math.PI,0);x.lineTo(540+w/2,bot);x.strokeStyle=`rgba(212,176,106,${a})`;x.lineWidth=lw;x.stroke()};
  arch(780,560,1470,2.5,.55);arch(740,600,1470,1,.3);
  x.textAlign='center';x.direction=he?'rtl':'ltr';
  x.fillStyle='#d4b06a';x.font='500 30px Fredoka, sans-serif';x.letterSpacing='10px';x.fillText(t('נ נח נחמ נחמן מאומן'),540,130);x.letterSpacing='0px';
  x.fillStyle='#f3ead7';fit(t('שקל אחד ביום'),960,'200 124px Heebo, sans-serif');x.fillText(t('שקל אחד ביום'),540,300);
  g=x.createLinearGradient(0,330,0,470);g.addColorStop(0,'#f1d697');g.addColorStop(.55,'#d2ab62');g.addColorStop(1,'#a97f39');x.fillStyle=g;fit(t('לרבינו'),960,'800 188px Heebo, sans-serif');x.fillText(t('לרבינו'),540,462);
  if(bx){const sh=x.createRadialGradient(540,1435,10,540,1435,330);sh.addColorStop(0,'rgba(0,0,0,.7)');sh.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=sh;x.beginPath();x.ellipse(540,1435,330,60,0,0,7);x.fill();const h=760,w=h*bx.width/bx.height;x.drawImage(bx,540-w/2,1450-h,w,h)}
  g=x.createLinearGradient(0,1500,0,1580);g.addColorStop(0,'#f1d697');g.addColorStop(1,'#b98d43');x.fillStyle=g;{const s1=(first?first+' · ':'')+t('קופה מס׳')+' '+String(boxNo).padStart(4,'0');fit(s1,960,'200 70px Heebo, sans-serif');x.fillText(s1,540,1565)}
  x.fillStyle='#cfc6b3';{const s2=streak>1?t(`${streak} בקרים ברצף · בזכותי עוד יהודי באומן`):t('בזכותי עוד יהודי באומן');fit(s2,960,'500 36px Fredoka, sans-serif');x.fillText(s2,540,1625)}
  // bottom: QR + call to action
  const qx=he?130:W-130-170,qy=1680,qs=170;x.fillStyle='#e6d3a6';x.beginPath();x.roundRect(qx,qy,qs,qs,18);x.fill();if(qr)x.drawImage(qr,qx+14,qy+14,qs-28,qs-28);
  const tx=he?950:130;x.textAlign=he?'right':'left';if(!he)x.direction='ltr';x.fillStyle='#f3ead7';fit(t('רוצים קופה משלכם?'),610,'200 56px Heebo, sans-serif');x.fillText(t('רוצים קופה משלכם?'),tx,1740);
  x.fillStyle='#d4b06a';fit(t('סרקו את הקוד · שקל אחד ביום'),610,'600 34px Fredoka, sans-serif');x.fillText(t('סרקו את הקוד · שקל אחד ביום'),tx,1792);
  x.fillStyle='#8f8878';x.font='500 26px Fredoka, sans-serif';x.fillText(url?location.host:location.host+'/r/'+ref,tx,1836);
  return new Promise(ok=>c.toBlob(ok,'image/png'))};
window.rbShare=async function(o,text){const blob=await rbCard(o);const f=new File([blob],'rabeinu-sheli.png',{type:'image/png'});
  if(navigator.canShare&&navigator.canShare({files:[f]})){try{await navigator.share({files:[f],text});return}catch(e){if(e.name==='AbortError')return}}
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='rabeinu-sheli.png';a.click();setTimeout(()=>open('https://wa.me/?text='+encodeURIComponent(text),'_blank'),500)};
window.RB_TEXT={en:'🔥 I took upon myself a shekel a day for Rebbe Nachman.\nA small box next to my tefillin – and on Rosh Hashanah all the shekels become a flight ticket to Uman for a Jew who has never been.\nWant one too? The box comes to your home 👇',es:'🔥 Me comprometí a poner un shéquel al día por el Rebe Najmán.\nUna pequeña alcancía junto a los tefilín, y en Rosh Hashaná todos los shéquels se convierten en un pasaje a Umán para un judío que nunca fue.\n¿Tú también? La alcancía llega a tu casa 👇'}[window.RB_LANG]||'🔥 לקחתי על עצמי שקל ביום לרבינו.\nקופה קטנה ליד התפילין – ובראש השנה כל השקלים הופכים לכרטיס טיסה לאומן ליהודי שעוד לא זכה.\nרוצה גם? הקופה מגיעה עד הבית 👇';
window.rbShareLink=async function(url,text){text=text||RB_TEXT;if(window.RB_LQ&&/\/r\//.test(url)&&url.indexOf('lang=')<0)url+=RB_LQ;try{if(navigator.share){await navigator.share({title:window.T?T('רבינו שלי'):'רבינו שלי',text,url});return}}catch(e){if(e.name==='AbortError')return}open('https://wa.me/?text='+encodeURIComponent(text+'\n'+url),'_blank')};
