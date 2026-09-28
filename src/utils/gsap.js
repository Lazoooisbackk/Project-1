import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Flip } from 'gsap/Flip';
import { Observer } from 'gsap/Observer';
import { CustomEase } from 'gsap/CustomEase';

gsap.registerPlugin(ScrollTrigger, Flip, Observer, CustomEase);
CustomEase.create('studio', '0.76, 0, 0.24, 1');
gsap.defaults({ ease: 'studio' });

export { gsap, ScrollTrigger, Flip, Observer, CustomEase };
