class color {
  constructor() {
    this.name = 'color';
  }
  static parse(value) {

  }
}

export const COLORS = {
  TRANSPARENT
};

export const isTransparent = (color) => (0xff & color) === 0;
export const parseColor = (value) => color.parse(Parser.create(value).parseComponentValue());