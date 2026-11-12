// hela koden ligger i en funktion eftersom pixi måste "vänta"
async function start() {

  // var musen är. -9999 = utanför skärmen så att inget händer från början
  let musX = -9999;
  let musY = -9999;
  // lista för alla celler
  const cells = [];
  // möjliga färger för cellerna
  const colors = [0x2b4cff, 0x00e5ff, 0x7a1cff, 0xff00d4, 0xff3c8e]; // blå, cyan, lila, magenta, rosa
  // namn under rubrik
  const mittNamn = 'Tuva Naring';
  // skärmens storlek
  const bredd = window.innerWidth;
  const height = window.innerHeight;
  // textstorleken är 15% av skärmens bredd
  const textStorlek = bredd * 0.15;
  // hur många pixlar mellan två celler
  const mellanrum = textStorlek / 14;
  // hur nära musen måste vara för att "cellerna"/texten ska reagera
  const musRadie = textStorlek * 0.9;
  // räknar sekunderna sen sidan öppnades (Claude assisterade med detta)
  let tid = 0;

  // Pixi delen
  const app = new PIXI.Application();
  await app.init({ width: bredd, height: height, background: '#07020d' }); // samma bakgrundsfärg som resten av sidan

  // canvas läggs in i diven i html (Claude rekommenderade att jag skulle skriva det i js istället för html för att ladda in texten först)
  document.getElementById('canvas-holder').appendChild(app.canvas);

  // ladda in fonts från html (google fonts)
  await document.fonts.load('100px "Archivo Black"');
  await document.fonts.load('500 20px "Space Grotesk"');

  // vita titeltexten på canvasen. Fick hjälp av Claude med hur jag skulle skriva text i Pixi canvas 
  // jag måste rita texten på en gömd canvas eftersom jag måste kunna läsa pixlarna (getImageData)
// för att sen veta var bokstäverna är. samma bild används sen för att visa texten i pixi
  const textCanvas = document.createElement('canvas');
  textCanvas.width = bredd;
  textCanvas.height = height;
  const ctx = textCanvas.getContext('2d');
  ctx.font = textStorlek + 'px "Archivo Black"';
  ctx.fillStyle = 'white';
  ctx.textAlign = 'center';  
  ctx.textBaseline = 'middle'; 
  ctx.fillText('DIGITAL', bredd / 2, height / 2 - textStorlek * 0.47);
  ctx.fillText('BIOMASS', bredd / 2, height / 2 + textStorlek * 0.47);

  // hämtar alla pixlar på gömda canvasen.
  const pixlar = ctx.getImageData(0, 0, bredd, height).data;

  // mitt namn under rubriken, i vanlig text och utan hovereffekt.
  ctx.font = '500 ' + (textStorlek * 0.13) + 'px "Space Grotesk"';
  ctx.fillText(mittNamn, bredd / 2, height / 2 + textStorlek * 1.15);

  // den gömda canvasen blir en bild som pixi visar
  const vitText = new PIXI.Sprite(PIXI.Texture.from(textCanvas));

  // Claude hjälpte till med det här problemet att texten lös igenom under hovereffekten
  // radergummit: tar bort den vita texten där vätskan är så att den slutade lysa igenom
  // inverse: true gör att masken gömmer istället för att visa
  const radergummi = new PIXI.Graphics();
  vitText.setMask({ mask: radergummi, inverse: true });

  // Gloweffekt ger neonskenet i kombination med lite blureffect och blend
  // 'add' gör att ljus som överlappar blir ännu ljusare, som riktig neon (Claude rekommendation)
  const glowLayer = new PIXI.Container();
  glowLayer.filters = [new PIXI.BlurFilter({ strength: 30 })];
  glowLayer.blendMode = 'add';
  glowLayer.alpha = 0.6;

  // smälta ihop cellerna effekt: 
  // varje cell är en prick som tonar ut mot kanten. när två celler är nära
  // överlappar kanterna och de smälter ihop. 
  const liquidLayer = new PIXI.Container();
  const kantFilter = new PIXI.ColorMatrixFilter();

  // kantfiltret gör allt som är "tillräckligt synligt" helt synligt och tar bort resten,
  // så cellerna blir en enda form. Detta var också Claude's idé då det från börjar bara såg ut som massor cirklar och
  // hade verkligen inte biomassa känsla. Promptande att ge mig kod som fick mina celler att "blenda ihop" snyggt. 

  // 4 rader: röd, grön, blå, alpha. bara sista raden (alpha = hur synlig pixeln är) ändras:
  // ny alpha = alpha x 3 - 1.2
  //   alpha 0.3 (svag kant) -> -0.3 -> osynlig
  //   alpha 0.5             ->  0.3 -> lite synlig = mjuk kant
  //   alpha 0.8 (inuti)     ->  1.2 -> helt synlig
  kantFilter.matrix = [
    1, 0, 0, 0, 0,
    0, 1, 0, 0, 0,
    0, 0, 1, 0, 0,
    0, 0, 0, 3, -1.2
  ];
  liquidLayer.filters = [kantFilter];

  // ordningen på sakerna så att det blir rätt layers.
  app.stage.addChild(vitText, radergummi, glowLayer, liquidLayer);

// CELLERNA
// canvas för att rita prickarna
  const cellCanvas = document.createElement('canvas');

  cellCanvas.width = 64;
  cellCanvas.height = 64;
  const cellCtx = cellCanvas.getContext('2d');
  // skapar en rund gradient 
  const gradient = cellCtx.createRadialGradient(32, 32, 0, 32, 32, 32);

  // bestämmer hur gradienten ser ut på olika avstånd från mitten.
  // (var är den, RGB VIT, hur synlig)
  gradient.addColorStop(0, 'rgba(255,255,255,1)');   // i mitten = vit och helt synlig
  gradient.addColorStop(0.5, 'rgba(255,255,255,0.6)'); // halvvägs ut = vit och lite genomskinlig
  gradient.addColorStop(1, 'rgba(255,255,255,0)');   // vid kanten = helt osynlig
// måla med gradient
  cellCtx.fillStyle = gradient;

  // eftersom gradienten är osynlig vid kanten syns det som en rund prick, inte en fyrkant (claude förklarade detta som smart sätt att göra cirkel)
  cellCtx.fillRect(0, 0, 64, 64);
// alla celler delar på en bild
  const cellBild = PIXI.Texture.from(cellCanvas);

  for (let y = 0; y < height; y += mellanrum) {
    for (let x = 0; x < bredd; x += mellanrum) {

      // kollar om pixeln är en del av en bokstav i titeln
      const alpha = pixlar[(Math.floor(y) * bredd + Math.floor(x)) * 4 + 3];

      if (alpha > 128) { //om mer än halvsynlig så (registreras som del av en bokstav i titeln) skapas en cell där
        // gör en cell + en glowykopia av den för neoneffekten
        const kropp = new PIXI.Sprite(cellBild);
        const glow = new PIXI.Sprite(cellBild);
        kropp.anchor.set(0.5);
        glow.anchor.set(0.5);
        kropp.alpha = 0; //osynligt från star (utan hover alltså)
        glow.alpha = 0; // samma här
        liquidLayer.addChild(kropp);
        glowLayer.addChild(glow);

        // sparar allt om cellen. randomness så de beter sig lite olika
        cells.push({
          kropp: kropp,                            // OG cellen
          glow: glow,                              // glowiga cellkopian som gör neoneffekten
          x: x,                                    // startplatsen, så att texten kan gå tillbaka
          y: y,
          near: 0,                                 // 0 = musen långt bort, 1 = musen precis ovanpå
          maxStorlek: 0.8 + Math.random() * 0.6,   // hur stor den kan bli randomness
          color: colors[Math.floor(Math.random() * colors.length)], // random färg
          fart: 0.5 + Math.random() * 1.5,         // hur snabbt den wobblar/gungar också random
          start: Math.random() * 10                // randomly var i gungandet den börjar
        });
      }
    }
  }

  app.ticker.add(function () {
    // räknar upp tiden i sekunder
    tid = tid + app.ticker.deltaMS / 1000;

    // tömmer radergummit varje bildruta. (Claude fix här också, radergummit visste jag inte va en grej själv)
    radergummi.clear();
    radergummi.circle(-100, -100, 1).fill(0xffffff);

    for (const c of cells) {
      // hur nära är musen?  1 = nära 0 = långt bort
      const distance = Math.hypot(musX - c.x, musY - c.y);
      let target = (1 - distance / musRadie) * 1.5;
      if (target > 1) target = 1;
      if (target < 0) target = 0;

      // near glider mot target. snabbt uppåt (0.12), långsamt neråt (0.015),
      // så att vätskan lämnar ett spår och texten formas tillbaka långsamt
      if (target > c.near) {
        c.near = c.near + (target - c.near) * 0.12;
      } else {
        c.near = c.near + (target - c.near) * 0.015;
      }

      // cellerna syns bara när musen är nära
      c.kropp.alpha = c.near;
      c.glow.alpha = c.near;

      // om den är nästan osynlig skippas resten
      if (c.near < 0.02) continue;

      // storleken växer när musen är nära. squish gör bredd och höjd olika = inte en perfekt cirkel (Claude idé också, utan prompt, bara självmant la till)
      const storlek = mellanrum * (1.5 + c.near * c.maxStorlek * 4) / 64;
      const squishX = storlek * (1 + 0.25 * Math.sin(tid * c.fart + c.start));
      const squishY = storlek * (1 + 0.25 * Math.cos(tid * c.fart + c.start));

      // cellen gungar runt i en liten cirkel, mer ju närmare musen är
      const gungX = c.x + Math.sin(tid * c.fart + c.start) * c.near * mellanrum * 1.2;
      const gungY = c.y + Math.cos(tid * c.fart + c.start) * c.near * mellanrum * 1.2;

      // uppdaterar cellen
      c.kropp.scale.set(squishX, squishY);
      c.kropp.position.set(gungX, gungY);
      c.kropp.tint = c.color;

      // uppdaterar glowyneoncellen, den är 2 gånger större så att neoneffekten syns runt cellerna
      c.glow.scale.set(squishX * 2, squishY * 2);
      c.glow.position.set(gungX, gungY);
      c.glow.tint = c.color;

      // raderar vita texten under cellen när den är stor nog att täcka hålet (claude's idé också)
      if (c.near > 0.4) {
        radergummi.circle(c.x, c.y, mellanrum * 0.8 * c.near).fill(0xffffff);
      }
    }
  });

  // sparar var musen är när den rör sig.
  window.addEventListener('pointermove', function (e) {
// pageX/pageY är platsen på hela sidan, så det blir rätt även när man har scrollat ner (Claude hjälpte med detta)
    musX = e.pageX;
    musY = e.pageY;
  });
}

// startar allt
start();