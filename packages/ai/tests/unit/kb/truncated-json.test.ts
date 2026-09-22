import { parseJsonObject, parseTruncatedJsonObject } from '../../../server-utils/exam';
import { parsePaperJson } from '../../../server-utils/paper';

describe('parseTruncatedJsonObject', () => {
  it('returns null for non-JSON text', () => {
    expect(parseTruncatedJsonObject('hello world')).toBeNull();
    expect(parseTruncatedJsonObject('')).toBeNull();
  });

  it('parses complete JSON unchanged', () => {
    const raw = '{"sections":[{"id":"A","questions":[{"n":1}]}]}';
    expect(parseTruncatedJsonObject(raw)).toEqual(JSON.parse(raw));
  });

  it('recovers an object cut off after a completed question', () => {
    const raw =
      '{"sections":[{"id":"A","questions":[' +
      '{"number":1,"text":"Define force."},' +
      '{"number":2,"text":"Calc';
    const parsed = parseTruncatedJsonObject(raw);
    expect(parsed).not.toBeNull();
    expect(parsed.sections[0].questions).toHaveLength(1);
    expect(parsed.sections[0].questions[0].number).toBe(1);
  });

  it('recovers when truncated mid-string value by closing the string', () => {
    const raw = '{"sections":[{"id":"A","questions":[{"number":1,"text":"State Newton';
    const parsed = parseTruncatedJsonObject(raw);
    expect(parsed).not.toBeNull();
    expect(parsed.sections[0].questions[0].text).toContain('State Newton');
  });

  it('drops a dangling key that never received a value', () => {
    const raw = '{"sections":[{"id":"A","questions":[{"number":1,"text":"Ok"}],"title":';
    const parsed = parseTruncatedJsonObject(raw);
    expect(parsed).not.toBeNull();
    expect(parsed.sections[0].questions).toHaveLength(1);
    expect(parsed.sections[0].title).toBeUndefined();
  });

  it('is reached via parsePaperJson when strict parse fails', () => {
    const strict = '{"sections":[],"extra":';
    expect(parseJsonObject(strict)).toBeNull();
    const viaPaper = parsePaperJson(strict);
    expect(viaPaper).toEqual({ sections: [] });
  });
});
