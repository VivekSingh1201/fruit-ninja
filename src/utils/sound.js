import slice from "../assets/bg-slice.mp3";
import explosion from "../assets/bg-bomb.mp3";
import bg from "../assets/bg-music.mp3";

export const sliceSound = new Audio(slice);
export const explosionSound = new Audio(explosion);
export const bgMusic = new Audio(bg);

bgMusic.loop = true;
bgMusic.volume = 0.4;