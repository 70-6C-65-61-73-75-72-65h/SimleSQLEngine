const SQLEngine = require("./index");
jest.unmock("./index");

let movieDatabase = {
  movie: [
    { id: 1, name: "Avatar", directorID: 1 },
    { id: 2, name: "Titanic", directorID: 1 },
    { id: 3, name: "Infamous", directorID: 2 },
    { id: 4, name: "Skyfall", directorID: 3 },
    { id: 5, name: "Aliens", directorID: 1 },
  ],
  actor: [
    { id: 1, name: "Leonardo DiCaprio" },
    { id: 2, name: "Sigourney Weaver" },
    { id: 3, name: "Daniel Craig" },
  ],
  director: [
    { id: 1, name: "James Cameron" },
    { id: 2, name: "Douglas McGrath" },
    { id: 3, name: "Sam Mendes" },
  ],
  actor_to_movie: [
    { movieID: 1, actorID: 2 },
    { movieID: 2, actorID: 1 },
    { movieID: 3, actorID: 2 },
    { movieID: 3, actorID: 3 },
    { movieID: 4, actorID: 3 },
    { movieID: 5, actorID: 2 },
  ],
};

describe("execution", function () {
  let engine = new SQLEngine(movieDatabase); // we dont do it beforeeach cause it wont chage the database ( just retrieve some data )
  const containArray = (actArr, expArr) =>
    expArr.every((expElem) => expect(actArr).toContainEqual(expElem)) &&
    actArr.every((actElem) => expect(expArr).toContainEqual(actElem));

  it("should SELECT columns", function () {
    let actual = engine.execute("SELECT movie.name FROM movie");
    let expectedIn = [
      { "movie.name": "Avatar" },
      { "movie.name": "Titanic" },
      { "movie.name": "Infamous" },
      { "movie.name": "Skyfall" },
      { "movie.name": "Aliens" },
    ];
    containArray(actual, expectedIn);
  });

  it("should apply WHERE", function () {
    let actual = engine.execute(
      "SELECT movie.name FROM movie WHERE movie.directorID = 1"
    );
    let expectedIn = [
      { "movie.name": "Avatar" },
      { "movie.name": "Titanic" },
      { "movie.name": "Aliens" },
    ];
    containArray(actual, expectedIn);
  });

  it("should perform parent->child JOIN", function () {
    let actual = engine.execute(
      "SELECT movie.name, director.name " +
        "FROM movie " +
        "JOIN director ON director.id = movie.directorID"
    );
    let expectedIn = [
      { "movie.name": "Avatar", "director.name": "James Cameron" },
      { "movie.name": "Titanic", "director.name": "James Cameron" },
      { "movie.name": "Aliens", "director.name": "James Cameron" },
      { "movie.name": "Infamous", "director.name": "Douglas McGrath" },
      { "movie.name": "Skyfall", "director.name": "Sam Mendes" },
    ];
    containArray(actual, expectedIn);
  });

  it("should perform child->parent JOIN ", function () {
    let actual = engine.execute(
      "SELECT movie.name, director.name " +
        "FROM director " +
        "JOIN movie ON director.id = movie.directorID"
    );
    let expectedIn = [
      { "movie.name": "Avatar", "director.name": "James Cameron" },
      { "movie.name": "Titanic", "director.name": "James Cameron" },
      { "movie.name": "Infamous", "director.name": "Douglas McGrath" },
      { "movie.name": "Skyfall", "director.name": "Sam Mendes" },
      { "movie.name": "Aliens", "director.name": "James Cameron" },
    ];
    containArray(actual, expectedIn);
  });

  it("should perform many-to-many FROM and apply WHERE", function () {
    let actual = engine.execute(
      "SELECT movie.name, actor.name " +
        "FROM movie " +
        "JOIN actor_to_movie ON actor_to_movie.movieID = movie.id " +
        "JOIN actor ON actor_to_movie.actorID = actor.id " +
        "WHERE actor.name <> 'Daniel Craig'"
    );
    let expectedIn = [
      { "movie.name": "Aliens", "actor.name": "Sigourney Weaver" },
      { "movie.name": "Avatar", "actor.name": "Sigourney Weaver" },
      { "movie.name": "Infamous", "actor.name": "Sigourney Weaver" },
      { "movie.name": "Titanic", "actor.name": "Leonardo DiCaprio" },
    ];
    containArray(actual, expectedIn);
  });
});
