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

/* Voronoi-Facetten: gerade Knicke wie bei zerknittertem Papier */
export const FACET = `
vec2 hash2(vec2 p){ p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))); return fract(sin(p)*43758.5453); }
vec2 facet(vec2 p,float sd){
  vec2 n=floor(p),f=fract(p); float md=8.0; vec2 id=vec2(0.0);
  for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){
    vec2 g=vec2(float(i),float(j));
    vec2 r=g+hash2(n+g+sd)-f;
    float d=dot(r,r);
    if(d<md){ md=d; id=n+g; }
  }
  return hash2(id*1.37+sd*3.1)*2.0-1.0;
}`;

/* Hero-Fläche über dem Verlaufs-Hintergrund: transparent, nur ein weicher Schatten unter dem O.
   Die Fluid-Maske (tMask) legt darunter eine dunkle Chromfolie oder ein Video frei.
   Ausgabe vormultipliziert (Canvas mit alpha). */
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
${NOISE}
${FACET}
vec3 foil(vec2 uv, vec3 L){
  vec2 p=vec2(uv.x*uAspect,uv.y);
  vec2 t=facet(p*9.0,1.0)*0.8+facet(p*21.0,4.0)*0.5+facet(p*45.0,8.0)*0.25;
  t+=vec2(snoise(vec3(p*2.0,uTime*0.05)),snoise(vec3(p*2.0,3.0+uTime*0.05)))*0.12;
  vec3 n=normalize(vec3(t,0.55));
  vec3 V=vec3(0.0,0.0,1.0);
  vec3 H=normalize(L+V);
  float spec=pow(max(dot(n,H),0.0),18.0);
  float fres=pow(1.0-max(dot(n,V),0.0),2.5);
  float f=dot(n,vec3(0.3,0.7,0.0))*3.0+uTime*0.2;
  vec3 irid=vec3(sin(f),sin(f+2.1),sin(f+4.2))*0.5+0.5;
  vec3 col=vec3(0.045,0.045,0.05);
  col+=vec3(0.55,0.56,0.6)*spec;
  col+=irid*fres*0.28;
  col+=max(dot(n,L),0.0)*0.06;
  return col;
}
void main(){
  vec3 L=normalize(vec3(uLight.x*0.9,uLight.y*0.9+0.35,0.9));
  vec2 q=vUv-uSh.xy; q.x*=uAspect;
  float d=length(q/uSh.zw);
  float shadow=uShA*exp(-d*d*1.6);

  float m=0.0;
  if(uMaskOn>0.5){
    vec3 dye=texture2D(tMask,vUv).rgb;
    float a=max(dye.r,max(dye.g,dye.b));
    m=smoothstep(0.06,0.55,a);
  }
  vec3 col=vec3(0.0);
  float alpha=shadow;
  if(m>0.001){
    vec3 under;
    if(uVideoOn>0.5){
      vec2 vuv=(vUv-0.5)*uVideoFit+0.5;
      under=texture2D(tVideo,vuv).rgb;
    } else {
      under=foil(vUv,L);
    }
    col=under*m;
    alpha=m+shadow*(1.0-m);
    /* Tintenrand: leicht dunkler Saum an der Kante der Maske */
    float edge=smoothstep(0.0,0.35,m)*(1.0-smoothstep(0.35,1.0,m))*0.18;
    col*=1.0-edge;
    alpha=alpha+edge*(1.0-alpha);
  }
  gl_FragColor=vec4(col,alpha);
}`;
