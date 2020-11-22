const { parseSQL } = require("./parserCheck");
function SQLEngine(db) {
  // this.database = database; // from and join
  let database = {};

  const populateLocalDB = () => {
    for (let dbkey in db) {
      database[dbkey.toLowerCase()] = db[dbkey].map((row) => {
        let newRow = {};
        for (let rk in row) {
          newRow[rk.toLowerCase()] = row[rk];
        }
        return newRow;
      });
    }
  };

  const clearLocalDB = () => (database = {});

  let workingTables = {};
  let joinable = {};

  const hasTable = (table) => {
    if (!(table in database))
      throw new Error(`there in such table ${table} in the database`);
  };

  const test = (operand1, compVal, operand2) => {
    switch (compVal) {
      case "<=": {
        // return
        return operand1 <= operand2;
      }
      case ">=": {
        return operand1 >= operand2;
      }
      case "<>": {
        return operand1 != operand2;
      }
      case "=": {
        return operand1 == operand2;
      }
      case ">": {
        return operand1 > operand2;
      }
      case "<": {
        return operand1 < operand2;
      }
      default: {
        throw new Error(`Not acceptable comparison operator ${compVal}`);
      }
    }
  };

  const isJoinable = () => (workingTables.join ? true : false);
  const chooseValuesFromColumns = (operand) => {
    let column;
    let hasJoin = isJoinable();
    let getColumnVal = (obj) => (i) =>
      hasJoin
        ? workingTables.join[i][obj.table][obj.column]
        : workingTables[obj.table][i][obj.column];

    column = getColumnVal(operand);
    return [column, hasJoin];
  };

  const operator = (operatorName) => {
    switch (operatorName) {
      case "select": {
        return {
          innerValues: "operands",
          method: function (columns) {
            let hasJoin = isJoinable();
            let selectFromTable = hasJoin
              ? workingTables.join
              : workingTables[Object.keys(workingTables)[0]];
            let workinColls = [];
            for (let col of columns) {
              workinColls.push({
                key: `${col.table}.${col.column}`,
                value: chooseValuesFromColumns(col)[0],
              });
            }

            let selectedRows = [];
            for (let row in selectFromTable) {
              let selectedRow = {};
              for (let wc of workinColls) {
                selectedRow[wc.key] = wc.value(row);
              }
              selectedRows.push(selectedRow);
            }
            return selectedRows;
          },
        };
      }

      case "from": {
        return {
          innerValues: "operand",
          method: function (table) {
            hasTable(table);
            workingTables = {
              ...workingTables,
              [table]: database[table],
            };
          },
        };
      }

      case "join": {
        return {
          innerValues: ["operand", "test"],
          method: function (table, testObj) {
            hasTable(table);
            let firstJoin = false;
            let joinTableIndex = null;
            if (Object.keys(joinable).length === 0) {
              workingTables["join"] = [];
              firstJoin = true;
            }
            workingTables = {
              ...workingTables,
              [table]: database[table],
            };
            let tables = [];
            let tablesNames = [testObj.operand1.table, testObj.operand2.table];
            let cols = [testObj.operand1.column, testObj.operand2.column];

            for (let index in tablesNames) {
              let table = tablesNames[index];
              let undefColl = workingTables[table][0][cols[index]];
              if (undefColl === void 0)
                throw new Error(
                  `there in such column ${cols[undefColl]} in the table ${table} in the database`
                );
              if (firstJoin) {
                joinable[table] = true;
                tables[index] = workingTables[table];
              } else {
                if (table in joinable) {
                  tables[index] = workingTables.join.map((wtj) => wtj[table]);
                  joinTableIndex = index;
                } else {
                  joinable[table] = true;
                  tables[index] = workingTables[table];
                }
              }
            }
            let joinRow = 0;
            let rows = [0, 0];
            for (; rows[0] < tables[0].length; rows[0] += 1) {
              for (rows[1] = 0; rows[1] < tables[1].length; rows[1] += 1) {
                if (
                  tables[0][rows[0]][cols[0]] === tables[1][rows[1]][cols[1]]
                ) {
                  if (firstJoin) {
                    workingTables.join[joinRow] = {
                      [tablesNames[0]]: tables[0][rows[0]],
                      [tablesNames[1]]: tables[1][rows[1]],
                    };
                    joinRow++;
                  } else {
                    workingTables.join[rows[joinTableIndex]][
                      tablesNames[+!+joinTableIndex]
                    ] = tables[+!+joinTableIndex][rows[+!+joinTableIndex]];
                  }
                }
              }
            }

            if (joinTableIndex !== null) {
              workingTables.join = workingTables.join.filter(
                (row) => tablesNames[+!+joinTableIndex] in row
              );
            }
          },
        };
      }
      case "where": {
        return {
          innerValues: "test",
          method: function (testObj) {
            let constant,
              column,
              arrayToFilter,
              hasJoin,
              filteredArray = [];

            let getFilterArray = (obj) =>
              hasJoin ? workingTables.join : workingTables[obj.table];

            if (testObj.operand1.value !== void 0) {
              constant = testObj.operand1.value;
              [column, hasJoin] = chooseValuesFromColumns(testObj.operand2);
              arrayToFilter = getFilterArray(testObj.operand2, hasJoin);
            } else {
              constant = testObj.operand2.value;
              [column, hasJoin] = chooseValuesFromColumns(testObj.operand1);
              arrayToFilter = getFilterArray(testObj.operand1, hasJoin);
            }

            for (let row in arrayToFilter) {
              if (test(column(row), testObj.comparison, constant)) {
                filteredArray.push(arrayToFilter[row]);
              }
            }

            if (hasJoin) {
              workingTables.join = filteredArray;
            } else {
              workingTables[Object.keys(workingTables)[0]] = filteredArray;
            }
          },
        };
      }
      default: {
        throw new Error(`Not acceptable operator ${operatorName}`);
      }
    }
  };

  this.callOperations = function callOps(ops) {
    for (let op of ops) {
      // keys
      let { innerValues, method } = operator(`${op.operator}`);

      // работает с обектом workingTables
      let res = Array.isArray(innerValues)
        ? method(...innerValues.map((val) => op[val]))
        : method(op[innerValues]);
      if (op.operator === "select") {
        return res;
      }

      if ("operations" in op) {
        // если есть join только в from
        callOps(op["operations"]);
      }
    }
  };

  this.execOperations = function (ops) {
    let operationsOrder = [];
    if (
      ops.length < 2 ||
      !(ops[0].operator === "select" && ops[1].operator === "from")
    ) {
      return null;
    } else if (ops.length === 3) {
      operationsOrder = [ops[1], ops[2], ops[0]];
    } else {
      // 2
      operationsOrder = [ops[1], ops[0]];
    }

    return this.callOperations(operationsOrder);
  };

  this.execute = function (query) {
    let parsedQuery = parseSQL(query);
    let result;
    if (parsedQuery && parsedQuery.res.operations) {
      populateLocalDB();
      result = this.execOperations(parsedQuery.res.operations);
      clearLocalDB();
    }
    return result;
  };
}

module.exports = SQLEngine;
