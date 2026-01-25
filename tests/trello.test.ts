import { describe, expect, it } from "bun:test";
import { parseCard, parseCardsFlat, parseCardsToTours } from "@/lib/trello/parser";
import type { TrelloCard, TrelloList } from "@/lib/trello/client";

describe("Trello card parsing", () => {
  it("parses simple card name as question", () => {
    const card: TrelloCard = {
      id: "1",
      name: "Какой город является столицей России?",
      desc: "",
      pos: 1,
      idShort: 1,
      idList: "list1",
      idBoard: "board1",
    };

    const result = parseCard(card, 0);
    expect(result.question).toBe("Какой город является столицей России?");
    expect(result.number).toBe(1); // from index
  });

  it("extracts number from card name", () => {
    const card: TrelloCard = {
      id: "1",
      name: "1. Какой город является столицей России?",
      desc: "",
      pos: 1,
      idShort: 1,
      idList: "list1",
      idBoard: "board1",
    };

    const result = parseCard(card, 0);
    expect(result.number).toBe(1);
    expect(result.question).toBe("Какой город является столицей России?");
  });

  it("extracts number with Q prefix", () => {
    const card: TrelloCard = {
      id: "1",
      name: "Q5: Вопрос про космос",
      desc: "",
      pos: 1,
      idShort: 5,
      idList: "list1",
      idBoard: "board1",
    };

    const result = parseCard(card, 0);
    expect(result.number).toBe(5);
    expect(result.question).toBe("Вопрос про космос");
  });

  it("parses answer from description", () => {
    const card: TrelloCard = {
      id: "1",
      name: "Столица России",
      desc: "Ответ: Москва",
      pos: 1,
      idShort: 1,
      idList: "list1",
      idBoard: "board1",
    };

    const result = parseCard(card, 0);
    expect(result.answer).toBe("Москва");
  });

  it("parses bold markdown answer", () => {
    const card: TrelloCard = {
      id: "1",
      name: "Столица России",
      desc: "**Ответ:** Москва",
      pos: 1,
      idShort: 1,
      idList: "list1",
      idBoard: "board1",
    };

    const result = parseCard(card, 0);
    expect(result.answer).toBe("Москва");
  });

  it("parses multiple fields from description", () => {
    const card: TrelloCard = {
      id: "1",
      name: "Вопрос про столицу",
      desc: `**Ответ:** Москва
**Зачёт:** Москва, столица
**Комментарий:** Это был простой вопрос
**Источник:** Википедия
**Автор:** Иван Иванов`,
      pos: 1,
      idShort: 1,
      idList: "list1",
      idBoard: "board1",
    };

    const result = parseCard(card, 0);
    expect(result.answer).toBe("Москва");
    expect(result.zachet).toBe("Москва, столица");
    expect(result.comment).toBe("Это был простой вопрос");
    expect(result.source).toBe("Википедия");
    expect(result.author).toBe("Иван Иванов");
  });

  it("parses English field names", () => {
    const card: TrelloCard = {
      id: "1",
      name: "Question about capital",
      desc: `**Answer:** Moscow
**Source:** Wikipedia`,
      pos: 1,
      idShort: 1,
      idList: "list1",
      idBoard: "board1",
    };

    const result = parseCard(card, 0);
    expect(result.answer).toBe("Moscow");
    expect(result.source).toBe("Wikipedia");
  });
});

describe("Trello cards to tours", () => {
  const lists: TrelloList[] = [
    { id: "list1", name: "Тур 1", pos: 1, idBoard: "board1" },
    { id: "list2", name: "Тур 2", pos: 2, idBoard: "board1" },
  ];

  const cards: TrelloCard[] = [
    {
      id: "1",
      name: "Вопрос 1",
      desc: "Ответ: А",
      pos: 1,
      idShort: 1,
      idList: "list1",
      idBoard: "board1",
    },
    {
      id: "2",
      name: "Вопрос 2",
      desc: "Ответ: Б",
      pos: 2,
      idShort: 2,
      idList: "list1",
      idBoard: "board1",
    },
    {
      id: "3",
      name: "Вопрос 3",
      desc: "Ответ: В",
      pos: 1,
      idShort: 3,
      idList: "list2",
      idBoard: "board1",
    },
  ];

  it("groups cards by list into tours", () => {
    const tours = parseCardsToTours(cards, lists);

    expect(tours.length).toBe(2);
    expect(tours[0].title).toBe("Тур 1");
    expect(tours[0].questions.length).toBe(2);
    expect(tours[1].title).toBe("Тур 2");
    expect(tours[1].questions.length).toBe(1);
  });

  it("sorts lists by position", () => {
    const reversedLists: TrelloList[] = [
      { id: "list2", name: "Тур 2", pos: 2, idBoard: "board1" },
      { id: "list1", name: "Тур 1", pos: 1, idBoard: "board1" },
    ];

    const tours = parseCardsToTours(cards, reversedLists);

    expect(tours[0].title).toBe("Тур 1");
    expect(tours[1].title).toBe("Тур 2");
  });

  it("sorts cards within tour by position", () => {
    const unorderedCards: TrelloCard[] = [
      {
        id: "2",
        name: "Второй",
        desc: "",
        pos: 20,
        idShort: 2,
        idList: "list1",
        idBoard: "board1",
      },
      {
        id: "1",
        name: "Первый",
        desc: "",
        pos: 10,
        idShort: 1,
        idList: "list1",
        idBoard: "board1",
      },
    ];

    const tours = parseCardsToTours(unorderedCards, lists);

    expect(tours[0].questions[0].question).toBe("Первый");
    expect(tours[0].questions[1].question).toBe("Второй");
  });
});

describe("Trello cards flat parsing", () => {
  it("parses cards as flat list", () => {
    const cards: TrelloCard[] = [
      {
        id: "1",
        name: "Q1",
        desc: "",
        pos: 2,
        idShort: 1,
        idList: "list1",
        idBoard: "board1",
      },
      {
        id: "2",
        name: "Q2",
        desc: "",
        pos: 1,
        idShort: 2,
        idList: "list1",
        idBoard: "board1",
      },
    ];

    const questions = parseCardsFlat(cards);

    expect(questions.length).toBe(2);
    expect(questions[0].question).toBe("Q2"); // sorted by pos
    expect(questions[1].question).toBe("Q1");
  });
});
