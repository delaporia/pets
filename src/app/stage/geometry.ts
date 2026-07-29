export interface Point {
  x: number;
  y: number;
}

export interface Rect extends Point {
  width: number;
  height: number;
}

export interface ActorAnchors {
  foot?: Point;
  body?: Point;
  grab?: Point;
  look?: Point;
  mouth?: Point;
  leftPaw?: Point;
  rightPaw?: Point;
}
