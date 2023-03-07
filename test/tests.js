/**
 * Very rudimentary test suite, as the API is very likely to change.
 * Ensures basic functionality should work.
 *
 * @file
 */
import Draughts from '../src/draughts.js';
import {assert} from 'chai';

describe('Game creation', () => {
    const draughts = new Draughts();

    it('Should start with white turn', () => {
        assert.equal(draughts.turn(), 'w');
    });

    it('Should start with 20 white pieces', () => {
        let count = 0;
        for (let i = 0; i < draughts.position().length; i++) {
            if (draughts.position()[i] === 'w') {
                count++;
            }
        }

        assert.equal(count, 20);
    });

    it('Should start with 20 black pieces', () => {
        let count = 0;
        for (let i = 0; i < draughts.position().length; i++) {
            if (draughts.position()[i] === 'b') {
                count++;
            }
        }

        assert.equal(count, 20);
    });

    it('Should give the proper moves for white', () => {
        const proper_moves = [
            {jumps: [], takes: [], from: 31, to: 27, pieces_taken: undefined},
            {jumps: [], takes: [], from: 31, to: 26, pieces_taken: undefined},
            {jumps: [], takes: [], from: 32, to: 28, pieces_taken: undefined},
            {jumps: [], takes: [], from: 32, to: 27, pieces_taken: undefined},
            {jumps: [], takes: [], from: 33, to: 29, pieces_taken: undefined},
            {jumps: [], takes: [], from: 33, to: 28, pieces_taken: undefined},
            {jumps: [], takes: [], from: 34, to: 30, pieces_taken: undefined},
            {jumps: [], takes: [], from: 34, to: 29, pieces_taken: undefined},
            {jumps: [], takes: [], from: 35, to: 30, pieces_taken: undefined}
        ];

        assert.deepEqual(draughts.moves(), proper_moves);
    });
});

describe('Game creation from FEN', () => {
    it('Should be able to generate an empty board', () => {
        const draughts = new Draughts('W:W:B');
        assert.equal(draughts.position(),
            '?00000000000000000000000000000000000000000000000000');
    });

    it('Should be able to create a complex board', () => {
        const draughts = new Draughts('W:WK7,25,28,33,35,36,38,39,48,49:B3,9,13,14,17,19,23,24');
        assert.equal(draughts.position(),
            '?00b000W0b000bb00b0b000bbw00w0000w0ww0ww00000000ww0');
    });
});

describe('Simple move and capture generation', () => {
    it('Should be possible for w to capture b', () => {
        const draughts = new Draughts('W:W28:B23');
        const proper_move = [
            {
                jumps: [28, 19],
                takes: [23],
                from: 28,
                to: 19,
                pieces_taken: ['b'],
                flags: 'c',
                captures: [28, 19],
                pieces_captured: ['b']
            }
        ];

        assert.deepEqual(draughts.moves(), proper_move);
    });

    it('Should be possible for w to capture B', () => {
        const draughts = new Draughts('W:W28:BK23');
        const proper_move = [
            {
                jumps: [28, 19],
                takes: [23],
                from: 28,
                to: 19,
                pieces_taken: ['B'],
                flags: 'c',
                captures: [28, 19],
                pieces_captured: ['B']
            }
        ];

        assert.deepEqual(draughts.moves(), proper_move);
    });

    it('Should be possible for b to capture w', () => {
        const draughts = new Draughts('B:W28:B23');
        const proper_move = [
            {
                jumps: [23, 32],
                takes: [28],
                from: 23,
                to: 32,
                pieces_taken: ['w'],
                flags: 'c',
                captures: [23, 32],
                pieces_captured: ['w']
            }
        ];

        assert.deepEqual(draughts.moves(), proper_move);
    });

    it('Should be possible for b to capture W', () => {
        const draughts = new Draughts('B:WK23:B28');
        const proper_move = [
            {
                jumps: [28, 19],
                takes: [23],
                from: 28,
                to: 19,
                pieces_taken: ['W'],
                flags: 'c',
                captures: [28, 19],
                pieces_captured: ['W']
            }
        ];

        assert.deepEqual(draughts.moves(), proper_move);
    });

    it('Should not be possible for b to capture B', () => {
        const draughts = new Draughts('B:WK1:B23,28');
        const proper_moves = [
            {jumps: [], takes: [], from: 23, to: 29, pieces_taken: undefined},
            {jumps: [], takes: [], from: 28, to: 33, pieces_taken: undefined},
            {jumps: [], takes: [], from: 28, to: 32, pieces_taken: undefined}
        ];

        assert.deepEqual(draughts.moves(), proper_moves);
    });
});

describe('PDN parsing', () => {
    const pdn = ['[Event "18th Computer Olympiad, 10x10 Draughts"]',
        '[Site "Leiden, NLD"]',
        '[Date "2015.07.04"]',
        '[Round "1"]',
        '[White "Scan"]',
        '[Black "Moby Dam (Jun 30 2015)"]',
        '[Result "1-0"]',
        '',
        '1. 34-30 19-23 2. 30-25 20-24 3. 33-29 24x33 4. 39x19 14x23 5. 40-34 9-14 6.',
        '44-39 14-20 7. 25x14 10x19 8. 50-44 5-10 9. 38-33 10-14 10. 42-38 23-28 11.',
        '32x23 18x40 12. 45x34 12-18 13. 35-30 7-12 14. 37-32 18-23 15. 44-40 12-18 16.',
        '41-37 1-7 17. 46-41 7-12 18. 47-42 23-28 19. 33x22 17x28 20. 32x23 19x28 21.',
        '38-32 13-19 22. 32x23 19x28 23. 43-38 8-13 24. 38-32 13-19 25. 32x23 19x28 26.',
        '42-38 11-17 27. 31-27 6-11 28. 38-33 18-23 29. 33x22 17x28 30. 37-31 11-17 31.',
        '27-22 28-32 32. 22x11 16x7 33. 48-42 12-18 34. 31-26 2-8 35. 36-31 7-12 36.',
        '40-35 15-20 37. 49-43 23-28 38. 34-29 12-17 39. 30-24 20-25 40. 42-38 25-30',
        '41. 38x27 30x19 42. 41-36 28-32 43. 27x38 19-23 44. 31-27 23x34 45. 39x30 8-12',
        '46. 30-24 3-8 47. 43-39 18-23 48. 27-21 23-28 49. 36-31 8-13 50. 35-30 14-19',
        '51. 21-16 12-18 52. 31-27 19-23 53. 38-33 28-32 54. 27x38 18-22 55. 24-20',
        '22-27 56. 30-24 17-21 57. 26x17 27-31 58. 17-12 31-36 59. 12-7 36-41 60. 38-32',
        '13-18 61. 7-2 23-29 62. 2-13 29x27 63. 13x47 4-10 64. 24-19 10-15 65. 47-24',
        '1-0'];

    const draughts = new Draughts();
    const parse_result = draughts.parsePdn(pdn.join('\n'));

    it('Should be able to parse a simple valid PDN', () => {
        assert.isTrue(parse_result);
    });

    it('Should be able to parse the PDN headers correctly', () => {
        const headers = {
            SetUp: '1',
            FEN: 'W:W31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50:B1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20',
            Event: '18th Computer Olympiad, 10x10 Draughts',
            Site: 'Leiden, NLD',
            Date: '2015.07.04',
            Round: '1',
            White: 'Scan',
            Black: 'Moby Dam (Jun 30 2015)',
            Result: '1-0'
        };

        assert.deepEqual(draughts.header(), headers);
    });
});

//
// describe("Perft", function() {
//   var perfts = [
//
//   ];
//
//   perfts.forEach(function(perft) {
//     var draughts = new Draughts();
//     draughts.load(perft.fen);
//
//     it(perft.fen, function() {
//       var nodes = draughts.perft(perft.depth);
//       assert(nodes == perft.nodes);
//     });
//
//   });
// });
//
//
// describe("Single Square Move Generation", function() {
//
//   var positions = [
//
//   ];
//
//   positions.forEach(function(position) {
//     var draughts = new Draughts();
//     draughts.load(position.fen);
//
//     it(position.fen + ' ' + position.square, function() {
//
//       var moves = draughts.moves({square: position.square, verbose: position.verbose});
//       var passed = position.moves.length == moves.length;
//
//       for (var j = 0; j < moves.length; j++) {
//         if (!position.verbose) {
//           passed = passed && moves[j] == position.moves[j];
//         } else {
//           for (var k in moves[j]) {
//             passed = passed && moves[j][k] == position.moves[j][k];
//           }
//         }
//       }
//       assert(passed);
//
//     });
//
//   });
//
// });
//
//
//
//
//
// describe("Insufficient Material", function() {
//
//   var positions = [
//
//   ];
//
//   positions.forEach(function(position) {
//     var draughts = new Draughts();
//     draughts.load(position.fen);
//
//     it(position.fen, function() {
//       if (position.draw) {
//         assert(draughts.insufficient_material() && draughts.in_draw());
//       } else {
//         assert(!draughts.insufficient_material() && !draughts.in_draw());
//       }
//     });
//
//   });
//
// });
//
//
// describe("Threefold Repetition", function() {
//
//   var positions = [
//
//   ];
//
//   positions.forEach(function(position) {
//     var draughts = new Draughts();
//     draughts.load(position.fen);
//
//     it(position.fen, function() {
//
//       var passed = true;
//       for (var j = 0; j < position.moves.length; j++) {
//         if (draughts.in_threefold_repetition()) {
//           passed = false;
//           break;
//         }
//         draughts.move(position.moves[j]);
//       }
//
//       assert(passed && draughts.in_threefold_repetition() && draughts.in_draw());
//
//     });
//
//   });
//
// });
//
//
// describe("Get/Put/Remove", function() {
//
//   var draughts = new Draughts();
//   var passed = true;
//   var positions = [
//
//   ];
//
//   positions.forEach(function(position) {
//
//     passed = true;
//     draughts.clear();
//
//     it("position should pass - " + position.should_pass, function() {
//
//       /* places the pieces */
//       for (var square in position.pieces) {
//         passed &= draughts.put(position.pieces[square], square);
//       }
//
//       /* iterate over every square to make sure get returns the proper
//        * piece values/color
//        */
//       for (var j = 0; j < draughts.SQUARES.length; j++) {
//         var square = draughts.SQUARES[j];
//         if (!(square in position.pieces)) {
//           if (draughts.get(square)) {
//             passed = false;
//             break;
//           }
//         } else {
//           var piece = draughts.get(square);
//           if (!(piece &&
//               piece.type == position.pieces[square].type &&
//               piece.color == position.pieces[square].color)) {
//             passed = false;
//             break;
//           }
//         }
//       }
//
//       if (passed) {
//         /* remove the pieces */
//         for (var j = 0; j < draughts.SQUARES.length; j++) {
//           var square = draughts.SQUARES[j];
//           var piece = draughts.remove(square);
//           if ((!(square in position.pieces)) && piece) {
//             passed = false;
//             break;
//           }
//
//           if (piece &&
//              (position.pieces[square].type != piece.type ||
//               position.pieces[square].color != piece.color)) {
//             passed = false;
//             break;
//           }
//         }
//       }
//
//       /* finally, check for an empty board */
//       passed = passed && (draughts.fen() == '8/8/8/8/8/8/8/8 w - - 0 1');
//
//       /* some tests should fail, so make sure we're supposed to pass/fail each
//        * test
//        */
//       passed = (passed == position.should_pass);
//
//       assert(passed);
//     });
//
//   });
//
// });
//
//
// describe("FEN", function() {
//
//   var positions = [
//   ];
//
//   positions.forEach(function(position) {
//     var draughts = new Draughts();
//
//     it(position.fen + ' (' + position.should_pass + ')', function() {
//       draughts.load(position.fen);
//       assert(draughts.fen() == position.fen == position.should_pass);
//     });
//
//   });
//
// });
//
//
// describe("PDN", function() {
//
//   var passed = true;
//   var error_message;
//   var positions = [
//
//     ];
//
//   positions.forEach(function(position, i) {
//
//     it(i, function() {
//       var draughts = ("starting_position" in position) ? new Draughts(position.starting_position) : new Draughts();
//       passed = true;
//       error_message = "";
//       for (var j = 0; j < position.moves.length; j++) {
//         if (draughts.move(position.moves[j]) === null) {
//           error_message = "move() did not accept " + position.moves[j] + " : ";
//           break;
//         }
//       }
//
//       draughts.header.apply(null, position.header);
//       var pdn = draughts.pdn({max_width:position.max_width, newline_char:position.newline_char});
//       var fen = draughts.fen();
//       passed = pdn === position.pdn && fen === position.fen;
//       assert(passed && error_message.length == 0);
//     });
//
//   });
//
// });
//
//
// describe("Load PDN", function() {
//
//   var draughts = new Draughts();
//   var tests = [
//   ];
//
//   var newline_chars = ['\n', '<br />', '\r\n', 'BLAH'];
//
//   tests.forEach(function(t, i) {
//     newline_chars.forEach(function(newline, j) {
//       it(i + String.fromCharCode(97 + j), function() {
//         var result = draughts.load_pdn(t.pdn.join(newline), { newline_char: newline });
//         var should_pass = t.expect;
//
//         /* some tests are expected to fail */
//         if (should_pass) {
//
//         /* some pdn's tests contain comments which are stripped during parsing,
//          * so we'll need compare the results of the load against a FEN string
//          * (instead of the reconstructed pdn [e.g. test.pdn.join(newline)])
//          */
//
//           if ('fen' in t) {
//             assert(result && draughts.fen() == t.fen);
//           } else {
//             assert(result && draughts.pdn({ max_width: 65, newline_char: newline }) == t.pdn.join(newline));
//           }
//         } else {
//           /* this test should fail, so make sure it does */
//           assert(result == should_pass);
//         }
//       });
//
//     });
//
//   });
//
//   // special case dirty file containing a mix of \n and \r\n
//   it('dirty pdn', function() {
//     var pdn;
//     var result = draughts.load_pdn(pdn, { newline_char: '\r?\n' });
//     assert(result);
//
//     assert(draughts.load_pdn(pdn));
//     assert(draughts.pdn().match(/^\[\[/) === null);
//   });
//
// });
//
//
// describe("Make Move", function() {
//
//   var positions = [
//
//   ];
//
//   positions.forEach(function(position) {
//     var draughts = new Draughts();
//     draughts.load(position.fen);
//     it(position.fen + ' (' + position.move + ' ' + position.legal + ')', function() {
//       var result = draughts.move(position.move);
//       if (position.legal) {
//         assert(result
//                && draughts.fen() == position.next
//                && result.captured == position.captured);
//       } else {
//         assert(!result);
//       }
//     });
//
//   });
//
// });
//
//
// describe("Validate FEN", function() {
//
//   var draughts = new Draughts();
//   var positions = [
//
//   ];
//
//   positions.forEach(function(position) {
//
//     it(position.fen + ' (valid: ' + (position.error_number  == 0) + ')', function() {
//       var result = draughts.validate_fen(position.fen);
//       assert(result.error_number == position.error_number, result.error_number);
//     });
//
//   });
// });
//
// describe("History", function() {
//
//   var draughts = new Draughts();
//   var tests = [
//   ];
//
//   tests.forEach(function(t, i) {
//     var passed = true;
//
//     it(i, function() {
//       draughts.reset();
//
//       for (var j = 0; j < t.moves.length; j++) {
//         draughts.move(t.moves[j])
//       }
//
//       var history = draughts.history({verbose: t.verbose});
//       if (t.fen != draughts.fen()) {
//         passed = false;
//       } else if (history.length != t.moves.length) {
//         passed = false;
//       } else {
//         for (var j = 0; j < t.moves.length; j++) {
//           if (!t.verbose) {
//             if (history[j] != t.moves[j]) {
//               passed = false;
//               break;
//             }
//           } else {
//             for (var key in history[j]) {
//               if (history[j][key] != t.moves[j][key]) {
//                 passed = false;
//                 break;
//               }
//             }
//           }
//         }
//       }
//       assert(passed);
//     });
//
//   });
// });
//
// describe('Regression Tests', function() {
//
// });
