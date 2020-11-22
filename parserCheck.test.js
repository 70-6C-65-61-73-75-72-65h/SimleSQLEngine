const parser = require("./parserCheck");
jest.unmock("./parserCheck");

describe(`parser module check`, () => {
  let txt, rgx;
  beforeAll(() => {
    ({ txt, rgx, opt, exc, any } = parser);
  });
  it(`should be "txt" function approp parsed`, () => {
    // txt(подстрока текста).exec(строка текста, позиция подстроки)
    let mainStr = "asdf";
    let substringsToParse = [
      { subs: "sdf", pos: 1, res: { res: "sdf", end: 4 } },
      { subs: "asd", pos: 0, res: { res: "asd", end: 3 } },
      { subs: "sdf", pos: 0, res: void 0 },
    ];
    substringsToParse.map((stp) =>
      expect(txt(stp.subs).exec(mainStr, stp.pos)).toEqual(stp.res)
    );
  });

  it(`should be "rxg" function approp parsed`, () => {
    let mainStr = "asd23f";
    let substringsToParse = [
      { subs: /\d+/, pos: 3, res: { res: "23", end: 5 } },
      { subs: /[a-zA-Z_]+/, pos: 2, res: { res: "d", end: 3 } },
      { subs: /\d+/, pos: 0, res: void 0 },
    ];
    substringsToParse.map((stp) =>
      expect(rgx(stp.subs).exec(mainStr, stp.pos)).toEqual(stp.res)
    );
  });

  it(`should be "opt" function approp parsed`, () => {
    let mainStr = "asd23f";
    let substringsToParse = [
      { subs: /\d+/, pos: 3, res: { res: "23", end: 5 } },
      { subs: /[a-zA-Z_]+/, pos: 2, res: { res: "d", end: 3 } },
      { subs: /\d+/, pos: 0, res: { res: void 0, end: 0 } },
    ];
    substringsToParse.map((stp) =>
      expect(opt(rgx(stp.subs)).exec(mainStr, stp.pos)).toEqual(stp.res)
    );
  });

  it(`should be "exc" function approp parsed`, () => {
    let pattern = exc(rgx(/[A-Z]/), txt("H"));
    let substringsToParse = [
      { str: "R", pos: 0, res: { res: "R", end: 1 } },
      { str: "H", pos: 0, res: void 0 },
    ];
    substringsToParse.map((stp) =>
      expect(pattern.exec(stp.str, stp.pos)).toEqual(stp.res)
    );
  });

  it(`should be "any" function approp parsed`, () => {
    // let pattern = any(rgx(/abc/), rgx(/def/)); // cant use text ( cause substr is case insencetive )
    let pattern = any(txt("abc"), txt("def"));
    let substringsToParse = [
      { str: "abc", pos: 0, res: { res: "abc", end: 3 } },
      { str: "def", pos: 0, res: { res: "def", end: 3 } },
      { str: "ABC", pos: 0, res: void 0 },
    ];
    substringsToParse.map((stp) =>
      expect(pattern.exec(stp.str, stp.pos)).toEqual(stp.res)
    );
  });
});
