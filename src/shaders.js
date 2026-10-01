/* Gemeinsame GLSL-Bausteine: Simplex-Noise, Knitter-Verschiebung, Hero-Fläche. */

/* Simplex noise 3D (Ashima Arts / Stefan Gustavson, MIT) */
export const NOISE = `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

/* Folien-Knitter: Ridged Noise schiebt die Fläche entlang der Normale rein und raus */
export const CRUMPLE = `
float crumple(vec3 p){
  vec3 q=p*4.6+vec3(uSeed*3.1,uSeed*1.7,uSeed*2.3);
  float n=(1.0-abs(snoise(q)))*0.55
         +(1.0-abs(snoise(q*2.07+11.3)))*0.30
         +(1.0-abs(snoise(q*4.30+27.1)))*0.15;
  return (n-0.62)*0.06*uAmt;
}`;

export const QUAD_V = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }`;

/* Hero-Fläche über dem Verlaufs-Hintergrund: transparent, nur ein weicher Schatten unter dem O.
   Die Fluid-Maske (tMask) legt darunter schillerndes Weiß frei (Perlmutt / Seifenhaut) oder ein Video.
   Reihenfolge beim Heilen der Maske: erst die Fläche, dann der Glow, zuletzt der Glitzer.
   Ausgabe vormultipliziert (Canvas mit alpha), Farbwerte direkt in sRGB. */
export const SHADE_F = `
varying vec2 vUv;
uniform vec2 uLight;
uniform vec4 uSh;
uniform float uShA;
uniform float uAspect;
uniform sampler2D tMask;
uniform float uMaskOn;
uniform sampler2D tVideo;
uniform float uVideoOn;
uniform vec2 uVideoFit;
uniform float uTime;
uniform float uIrid;
uniform float uStreak;
uniform float uSparkle;
uniform float uBloom;
uniform float uDpr;
uniform float uInkFill;
${NOISE}
float hash12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*0.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec2 hash22(vec2 p){ vec3 p3=fract(vec3(p.xyx)*vec3(0.1031,0.1030,0.0973)); p3+=dot(p3,p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }

/* Dünnfilm-Interferenz: reflektierte Farbe eines Films der Dicke d (nm), n = 1.33, bei Blickwinkel cosT */
vec3 thinFilm(float d, float cosT){
  float opd=2.0*1.33*d*cosT;
  return 0.5+0.5*cos(6.2831853*opd/vec3(650.0,532.0,450.0));
}

/* Perlmutt: Basis #F5F3EE, zarte Dünnfilm-Farben je nach Blickwinkel und Ort,
   dazu ein gebürsteter Lichtstreifen (Anisotropie), der durch den Zeiger läuft */
vec3 pearl(vec2 uv, out vec3 film){
  vec2 p=vec2(uv.x*uAspect,uv.y);
  float t=uTime*0.06;
  vec2 g=vec2(snoise(vec3(p*1.6,t)),snoise(vec3(p*1.6+7.3,t)));
  vec3 n=normalize(vec3(g*0.5,1.0));
  vec2 lp=0.5+uLight*0.5;
  vec3 V=normalize(vec3((uv-lp)*vec2(uAspect,1.0)*0.9,1.0));
  float cosT=clamp(dot(n,V),0.0,1.0);
  float d=380.0+170.0*snoise(vec3(p*0.9,t*0.7+3.0))+60.0*snoise(vec3(p*3.1,t+9.0));
  film=thinFilm(d,cosT);
  vec3 chroma=film-dot(film,vec3(1.0/3.0));

  vec3 col=vec3(0.961,0.953,0.933);
  col*=0.9+0.1*clamp(dot(n,normalize(vec3(uLight*0.6,1.0))),0.0,1.0);

  vec2 dir=normalize(vec2(0.62,0.78));
  vec2 q=(uv-lp)*vec2(uAspect,1.0);
  float across=dot(q,vec2(-dir.y,dir.x)), along=dot(q,dir);
  float brushed=0.65+0.35*snoise(vec3(along*3.0,across*42.0,t*2.0));
  float band=exp(-across*across/0.006)*brushed*uStreak;

  col+=chroma*uIrid*(0.3+0.25*band);
  col+=band*0.12;
  return clamp(col,0.0,1.0);
}

/* Glitzer: Raster aus 4-CSS-px-Zellen, ein Teil davon trägt ein Korn (1–2 px), das zufällig
   für 0,3–0,8 s aufblitzt. Bei uSparkle = 1 leuchten höchstens ca. 1,6 % der Fläche gleichzeitig. */
float sparkle(vec2 frag){
  float cell=4.0*uDpr;
  vec2 id=floor(frag/cell), f=frag/cell-id;
  float h=hash12(id);
  if(h>uSparkle*0.9) return 0.0;
  vec2 h2=hash22(id+17.0);
  float T=1.8+h2.x*3.2, D=0.3+h2.y*0.5;
  float lt=mod(uTime+h*97.0,T);
  if(lt>D) return 0.0;
  float env=sin(3.14159265*lt/D); env*=env;
  vec2 c=0.25+0.5*hash22(id+3.1);
  float r=(0.5+0.5*hash12(id+9.7))*0.25;
  return env*(1.0-smoothstep(r*0.35,r,length(f-c)));
}

void main(){
  vec2 q=vUv-uSh.xy; q.x*=uAspect;
  float d=length(q/uSh.zw);
  float shadow=uShA*exp(-d*d*1.6);

  float a=0.0;
  if(uMaskOn>0.5){
    vec3 dye=texture2D(tMask,vUv).rgb;
    a=max(dye.r,max(dye.g,dye.b));
  }
  a=max(a,uInkFill);
  vec3 col=vec3(0.0);
  float alpha=shadow;
  if(a>0.003){
    float m=smoothstep(0.06,0.55,a);
    vec3 film=vec3(0.5);
    vec3 under;
    if(uVideoOn>0.5){
      vec2 vuv=(vUv-0.5)*uVideoFit+0.5;
      under=texture2D(tVideo,vuv).rgb;
    } else {
      under=pearl(vUv,film);
    }
    /* Bloom: heller Rand an der Kante der Tinte und weicher Glow darüber hinaus */
    float rim=smoothstep(0.0,0.35,m)*(1.0-smoothstep(0.35,1.0,m));
    under=min(under+rim*uBloom*0.3,1.0);
    float glow=smoothstep(0.012,0.3,a)*(1.0-m)*uBloom*0.5;
    col=vec3(1.0,0.99,0.975)*glow;
    alpha=glow+shadow*(1.0-glow);
    col=under*m+col*(1.0-m);
    alpha=m+alpha*(1.0-m);

    /* Glitzer bleibt am längsten: niedrigste Schwelle der Maske */
    float sp=sparkle(gl_FragCoord.xy)*smoothstep(0.003,0.08,a);
    vec3 spc=mix(vec3(1.0),clamp(film*1.3,0.0,1.0),0.35);
    col=spc*sp+col*(1.0-sp);
    alpha=sp+alpha*(1.0-sp);
  }
  gl_FragColor=vec4(col,alpha);
}`;
