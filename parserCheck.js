function Pattern(exec) {
  this.exec = exec;
  this.patternName = null; //exec.name;

  // метод который обрабатывает результат
  this.then = function (transform) {
    return new Pattern(function (str, pos) {
      var r = exec(str, pos);
      return r && { res: transform(r.res), end: r.end };
    });
  };

  //  чисто для отладки
  // {
  //   this.addPatternName = function (patternName) {
  //     this.patternName = patternName;
  //   };
  // }
}

function txt(text) {
  // case insensetive so better not to use if case sencetive cases
  return new Pattern(function textPattern(str, pos) {
    if (str.substr(pos, text.length) === text)
      return { res: text, end: pos + text.length };
  });
}

function rgx(regex) {
  return new Pattern(function regexPattern(str, pos) {
    let m = regex.exec(str.slice(pos));
    if (m && m.index === 0) {
      return { res: m[0], end: pos + m[0].length };
    }
  });
}

function opt(pattern) {
  return new Pattern(function optionalPattern(str, pos) {
    return pattern.exec(str, pos) || { res: void 0, end: pos };
  });
}

function exc(pattern, except) {
  return new Pattern(function exceptPattern(str, pos) {
    return !except.exec(str, pos) ? pattern.exec(str, pos) : void 0;
  });
}

function any(...patterns) {
  return new Pattern(function anyPattern(str, pos) {
    for (let res, index = 0; index < patterns.length; index++) {
      if ((res = patterns[index].exec(str, pos))) return res;
    }
  });
}

function seq(...patterns) {
  return new Pattern(function sequencePattern(str, pos) {
    // (separator, 0) (pattern, 0)
    let i,
      resElem,
      end = (pos = pos || 0),
      resArr = [];
    for (i = 0; i < patterns.length; i++) {
      resElem = patterns[i].exec(str, end);
      if (!resElem) return;
      resArr.push(resElem.res);
      end = resElem.end;
    }

    return { res: resArr, end: end };
  });
}

function rep(pattern, separator) {
  //  , elem
  var separated = !separator
    ? pattern
    : seq(separator, pattern).then((r) => r[1]);

  return new Pattern(function repeatPattern(str, pos) {
    var res = [],
      end = pos,
      r = pattern.exec(str, end);

    while (r && r.end > end) {
      res.push(r.res);
      end = r.end;
      r = separated.exec(str, end);
    }

    return res.length !== 0 ? { res: res, end: end } : void 0;
  });
}

function parseSQL(str) {
  const keyAndIndexRetrieve = (keysIndexes, arr) =>
    keysIndexes.reduce(function (acum, keyInd) {
      if (arr[keyInd.ind] !== void 0) {
        if (keyInd.isArr) {
          if (acum[keyInd.key]) {
            acum[keyInd.key].push(arr[keyInd.ind]);
          } else {
            acum[keyInd.key] = [arr[keyInd.ind]];
          }
        } else {
          acum[keyInd.key] = arr[keyInd.ind];
        }
      }
      return acum;
    }, {});

  const tableNameNotToBe = ["join", "select", "where", "from", "on"];
  const tableName = rgx(/[a-zA-Z0-9_]+/i).then((r) => {
    r = r.toLowerCase();
    if (tableNameNotToBe.some((tn) => r === tn))
      throw new Error("table name should not to be like operator name");
    return r;
  });
  const columnName = rgx(/[a-zA-Z0-9_]+/i).then((r) => r.toLowerCase());

  const sqlStringRetrieve = [{ key: "value", ind: 1 }];
  const sqlString = seq(txt("'"), rgx(/[^']*/), txt("'")).then((r) =>
    keyAndIndexRetrieve(sqlStringRetrieve, r)
  );

  const number = rgx(/\d+/).then((r) => ({ value: r }));

  const constant = any(number, sqlString);

  const comparison = any(
    txt("<="),
    txt(">="),
    txt("<>"),
    txt("="),
    txt(">"),
    txt("<")
  );

  const ws = rgx(/\s+/);

  const columnId = seq(columnName, txt("."), tableName).then((r) => ({
    table: r[0],
    column: r[2],
  }));

  const value = any(columnId, constant);

  const valueTestRetrieve = [
    { key: "operand1", ind: 0 },
    { key: "comparison", ind: 2 },
    { key: "operand2", ind: 4 },
  ];
  const columnIdTestRetrieve = [
    { key: "operand1", ind: 0 },
    { key: "comparison", ind: 2 },
    { key: "operand2", ind: 4 },
  ];
  const columnIdTest = seq(
    columnId,
    opt(ws),
    comparison,
    opt(ws),
    columnId
  ).then((r) => keyAndIndexRetrieve(columnIdTestRetrieve, r));

  const constantColumnIdTest = any(
    seq(constant, opt(ws), comparison, opt(ws), columnId).then((r) =>
      keyAndIndexRetrieve(columnIdTestRetrieve, r)
    ),
    seq(columnId, opt(ws), comparison, opt(ws), constant).then((r) =>
      keyAndIndexRetrieve(columnIdTestRetrieve, r)
    )
  );

  const whereRetrieve = [
    { key: "operator", ind: 1 },
    { key: "test", ind: 3 },
  ];

  const where = seq(
    opt(ws),
    rgx(/where/i).then((r) => r.toLowerCase()),
    ws,
    constantColumnIdTest
  ).then((r) => keyAndIndexRetrieve(whereRetrieve, r));

  const joinRetrieve = [
    { key: "operator", ind: 0 },
    { key: "operand", ind: 2 },
    { key: "test", ind: 6 },
  ];

  const join = seq(
    rgx(/join/i).then((r) => r.toLowerCase()),
    ws,
    tableName,
    ws,
    rgx(/on/i),
    ws,
    columnIdTest
  ).then((r) => keyAndIndexRetrieve(joinRetrieve, r));

  const fromRetrieve = [
    { key: "operator", ind: 1 },
    { key: "operand", ind: 3 },
    { key: "operations", ind: 5 }, // if not void 0
  ];

  const from = seq(
    ws,
    rgx(/from/i).then((r) => r.toLowerCase()),
    ws,
    tableName,
    opt(ws),
    opt(rep(join, ws))
  ).then((r) => {
    return keyAndIndexRetrieve(fromRetrieve, r);
  });

  const selectRetrieve = [
    { key: "operator", ind: 1 },
    { key: "operands", ind: 3 },
  ];

  const select = seq(
    opt(ws),
    rgx(/select/i).then((r) => r.toLowerCase()),
    ws,
    rep(columnId, rgx(/\s*,\s*/))
  ).then((r) => keyAndIndexRetrieve(selectRetrieve, r));

  const queryRetrieve = [
    { key: "operations", ind: 0, isArr: true },
    { key: "operations", ind: 1, isArr: true },
    { key: "operations", ind: 2, isArr: true }, // if not void 0
  ];

  const query = seq(select, from, opt(where)).then((r) =>
    keyAndIndexRetrieve(queryRetrieve, r)
  );

  // let queryStringified = query.then((r) => JSON.stringify(r));

  //  чисто для отладки
  // {
  //   const patternNames = [
  //     { ws: ws },
  //     { join: join },
  //     { select: select },
  //     { join: join },
  //     { query: query },
  //     { queryStringified: queryStringified },
  //     { from: from },
  //     { where: where },
  //     { columnIdTest: columnIdTest },
  //     { valueTest: valueTest },
  //     { column: columnId },
  //     { comparison: comparison },
  //     { constant: constant },
  //     { sqlString: sqlString },
  //     { tableName: tableName },
  //     { column: columnName },
  //     { constantColumnIdTest: constantColumnIdTest },
  //   ];
  //   const addPatternNames = (pns) => {
  //     pns.map((pn) => {
  //       let [key, val] = Object.entries(pn)[0];
  //       val.addPatternName(key);
  //     });
  //   };
  //   addPatternNames(patternNames);
  // }

  return query.exec(str);
}
module.exports = { txt, rgx, opt, exc, any, parseSQL };
