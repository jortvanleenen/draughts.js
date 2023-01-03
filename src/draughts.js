'use strict';

/*
||==================================================================================
|| DESCRIPTION OF IMPLEMENTATION PRINCIPLES
|| A. Position for rules (internal representation): string with length 56.
||    Special numbering for easy applying rules.
||    Valid characters: b B w W 0 -
||       b (black) B (black king) w (white) W (white king) 0 (empty) (- unused)
||    Examples:
||      '-bbbBBB000w-wwWWWwwwww-bbbbbbbbbb-000wwwwwww-00bbbwwWW0-'
||      '-0000000000-0000000000-0000000000-0000000000-0000000000-'  (empty position)
||      '-bbbbbbbbbb-bbbbbbbbbb-0000000000-wwwwwwwwww-wwwwwwwwww-'  (start position)
|| B. Position (external respresentation): string with length 51.
||    Square numbers are represented by the position of the characters.
||    Position 0 is reserved for the side to move (B or W)
||    Valid characters: b B w W 0
||       b (black) B (black king) w (white) W (white king) 0 (empty)
||    Examples:
||       'B00000000000000000000000000000000000000000000000000'  (empty position)
||       'Wbbbbbbbbbbbbbbbbbbbb0000000000wwwwwwwwwwwwwwwwwwww'  (start position)
||       'WbbbbbbBbbbbb00bbbbb000000w0W00ww00wwwwww0wwwwwwwww'  (random position)
||
|| External numbering      Internal Numbering
|| --------------------    --------------------
||   01  02  03  04  05      01  02  03  04  05
|| 06  07  08  09  10      06  07  08  09  10
||   11  12  13  14  15      12  13  14  15  16
|| 16  17  18  19  20      17  18  19  20  21
||   21  22  23  24  25      23  24  25  26  27
|| 26  27  28  29  30      28  29  30  31  32
||   31  32  33  34  35      34  35  36  37  38
|| 36  37  38  39  40      39  40  41  42  43
||   41  42  43  44  45      45  46  47  48  49
|| 46  47  48  49  50      50  51  52  53  54
|| --------------------    --------------------
||
|| Internal numbering has fixed direction increments for easy applying rules:
||   NW   NE         -5   -6
||     \ /             \ /
||     sQr     >>      sQr
||     / \             / \
||   SW   SE         +5   +6
||
|| DIRECTION-STRINGS
|| Strings of variable length for each of four directions at one square.
|| Each string represents the position in that direction.
|| Directions: NE, SE, SW, NW (wind directions)
|| Example for square 29 (internal number):
||   NE: 29, 24, 19, 14, 09, 04     b00bb0
||   SE: 35, 41, 47, 53             bww0
||   SW: 34, 39                     b0
||   NW: 23, 17                     bw
|| CONVERSION internal to external representation of numbers.
||   N: external number, values 1..50
||   M: internal number, values 0..55 (invalid 0,11,22,33,44,55)
||   Formulas:
||   M = N + floor((N-1)/10)
||   N = M - floor((M-1)/11)
||
||==================================================================================
*/
const Draughts = function (fen) {
  const BLACK = 'B';
  const WHITE = 'W';
  // var EMPTY = -1
  const MAN = 'b';
  const KING = 'w';
  const SYMBOLS = 'bwBW';
  const DEFAULT_FEN = 'W:W31-50:B1-20';
  let position;
  const DEFAULT_POSITION_INTERNAL = '-bbbbbbbbbb-bbbbbbbbbb-0000000000-wwwwwwwwww-wwwwwwwwww-';
  const DEFAULT_POSITION_EXTERNAL = 'Wbbbbbbbbbbbbbbbbbbbb0000000000wwwwwwwwwwwwwwwwwwww';
  const STEPS = {NE: -5, SE: 6, SW: 5, NW: -6};
  const POSSIBLE_RESULTS = ['2-0', '0-2', '1-1', '0-0', '*', '1-0', '0-1'];
  const FLAGS = {
    NORMAL: 'n', CAPTURE: 'c',
    PROMOTION: 'p'
  };

  const UNICODES = {
    'w': '\u26C0',
    'b': '\u26C2',
    'B': '\u26C3',
    'W': '\u26C1',
    '0': '\u0020\u0020'
  };

  const SIGNS = {
    n: '-',
    c: 'x'
  };

  const BITS = {
    NORMAL: 1,
    CAPTURE: 2,
    PROMOTION: 4
  };

  let turn = WHITE;
  let number_of_moves = 1;
  let history = [];
  let header = {};
  let states = [];

  if (!fen) {
    position = DEFAULT_POSITION_INTERNAL;
    load(DEFAULT_FEN);
  } else {
    position = DEFAULT_POSITION_INTERNAL;
    load(fen);
  }

  function clear(remove_states = true) {
    position = DEFAULT_POSITION_INTERNAL;
    turn = WHITE;
    number_of_moves = 1;
    history = [];
    if (remove_states) {
      states = [];
    }
    header = {};
    update_setup(generate_fen());
  }

  function reset() {
    load(DEFAULT_FEN);
  }

  function load(fen) {
    // TODO for default fen
    if (!fen || fen === DEFAULT_FEN) {
      position = DEFAULT_POSITION_INTERNAL;
      update_setup(generate_fen(position));
      return true;
    }
    // fen_constants(dimension) //TODO for empty fens

    var checkedFen = validate_fen(fen);
    if (!checkedFen.valid) {
      console.error('Fen Error', fen, checkedFen);
      return false;
    }
    if (position) {
      clear();
    }

    // remove spaces
    fen = fen.replace(/\s+/g, '');
    // remove suffixes
    fen.replace(/\..*$/, '');

    var tokens = fen.split(':');
    // which side to move
    turn = tokens[0].substr(0, 1);

    // var positions = new Array()
    var externalPosition = DEFAULT_POSITION_EXTERNAL;
    for (var i = 1; i <= externalPosition.length; i++) {
      externalPosition = setCharAt(externalPosition, i, 0);
    }
    externalPosition = setCharAt(externalPosition, 0, turn);
    // TODO refactor
    for (var k = 1; k <= 2; k++) {
      // TODO called twice
      var color = tokens[k].substr(0, 1);
      var sideString = tokens[k].substr(1);
      if (sideString.length === 0) continue;
      var numbers = sideString.split(',');
      for (i = 0; i < numbers.length; i++) {
        var numSquare = numbers[i];
        var isKing = (numSquare.substr(0, 1) === 'K');
        numSquare = (isKing === true ? numSquare.substr(1) : numSquare); // strip K
        var range = numSquare.split('-');
        if (range.length === 2) {
          var from = parseInt(range[0], 10);
          var to = parseInt(range[1], 10);
          for (var j = from; j <= to; j++) {
            externalPosition = setCharAt(externalPosition, j, (isKing === true ? color.toUpperCase() : color.toLowerCase()));
          }
        } else {
          numSquare = parseInt(numSquare, 10);
          externalPosition = setCharAt(externalPosition, numSquare, (isKing === true ? color.toUpperCase() : color.toLowerCase()));
        }
      }
    }

    position = convertPosition(externalPosition, 'internal');
    update_setup(generate_fen(position));

    return true;
  }

  function validate_fen(fen) {
    var errors = [
      {
        code: 0,
        message: 'no errors'
      },
      {
        code: 1,
        message: 'fen position not a string'
      },
      {
        code: 2,
        message: 'fen position has not colon at second position'
      },
      {
        code: 3,
        message: 'fen position has not 2 colons'
      },
      {
        code: 4,
        message: 'side to move of fen position not valid'
      },
      {
        code: 5,
        message: 'color(s) of sides of fen position not valid'
      },
      {
        code: 6,
        message: 'squares of fen position not integer'
      },
      {
        code: 7,
        message: 'squares of fen position not valid'
      },
      {
        code: 8,
        message: 'empty fen position'
      }
    ];

    if (typeof fen !== 'string') {
      return {valid: false, error: errors[0], fen: fen};
    }

    fen = fen.replace(/\s+/g, '');

    if (fen === 'B::' || fen === 'W::' || fen === '?::') {
      return {valid: true, fen: fen + ':B:W'}; // exception allowed i.e. empty fen
    }
    fen = fen.trim();
    fen = fen.replace(/\..*$/, '');

    if (fen === '') {
      return {valid: false, error: errors[7], fen: fen};
    }

    if (fen.substr(1, 1) !== ':') {
      return {valid: false, error: errors[1], fen: fen};
    }

    // fen should be 3 sections separated by colons
    var parts = fen.split(':');
    if (parts.length !== 3) {
      return {valid: false, error: errors[2], fen: fen};
    }

    //  which side to move
    var turnColor = parts[0];
    if (turnColor !== 'B' && turnColor !== 'W' && turnColor !== '?') {
      return {valid: false, error: errors[3], fen: fen};
    }

    // check colors of both sides
    var colors = parts[1].substr(0, 1) + parts[2].substr(0, 1);
    if (colors !== 'BW' && colors !== 'WB') {
      return {valid: false, error: errors[4], fen: fen};
    }

    // check parts for both sides
    for (var k = 1; k <= 2; k += 1) {
      var sideString = parts[k].substr(1); // Stripping color
      if (sideString.length === 0) {
        continue;
      }
      var numbers = sideString.split(',');
      for (var i = 0; i < numbers.length; i++) {
        var numSquare = numbers[i];
        var isKing = (numSquare.substr(0, 1) === 'K');
        numSquare = (isKing === true ? numSquare.substr(1) : numSquare);
        var range = numSquare.split('-');
        if (range.length === 2) {
          if (isInteger(range[0]) === false) {
            return {valid: false, error: errors[5], fen: fen, range: range[0]};
          }
          if (!(range[0] >= 1 && range[0] <= 100)) {
            return {valid: false, error: errors[6], fen: fen};
          }
          if (isInteger(range[1]) === false) {
            return {valid: false, error: errors[5], fen: fen};
          }
          if (!(range[1] >= 1 && range[1] <= 100)) {
            return {valid: false, error: errors[6], fen: fen};
          }
        } else {
          if (isInteger(numSquare) === false) {
            return {valid: false, error: errors[5], fen: fen};
          }
          if (!(numSquare >= 1 && numSquare <= 100)) {
            return {valid: false, error: errors[6], fen: fen};
          }
        }
      }
    }

    return {valid: true, error_number: 0, error: errors[0]};
  }

  function generate_fen() {
    var black = [];
    var white = [];
    var externalPosition = convertPosition(position, 'external');
    for (var i = 0; i < externalPosition.length; i++) {
      switch (externalPosition[i]) {
        case 'w':
          white.push(i);
          break;
        case 'W':
          white.push('K' + i);
          break;
        case 'b':
          black.push(i);
          break;
        case 'B':
          black.push('K' + i);
          break;
        default:
          break;
      }
    }
    return turn.toUpperCase() + ':W' + white.join(',') + ':B' + black.join(',');
  }

  function generatePDN(options) {
    // for html usage {maxWidth: 72, newline_char: "<br />"}
    var newline = (typeof options === 'object' && typeof options.newline_char === 'string')
      ? options.newline_char : '\n';
    var maxWidth = (typeof options === 'object' && typeof options.maxWidth === 'number')
      ? options.maxWidth : 0;
    var result = [];
    var headerExists = false;

    for (var i in header) {
      result.push('[' + i + ' "' + header[i] + '"]' + newline);
      headerExists = true;
    }

    if (headerExists && history.length) {
      result.push(newline);
    }

    var tempHistory = clone(history);

    var moves = [];
    var moveString = '';
    var moveNumber = 1;

    while (tempHistory.length > 0) {
      var move = tempHistory.shift();
      if (move.turn === 'W') {
        moveString += moveNumber + '. ';
      }
      moveString += move.move.from;
      if (move.move.flags === 'c') {
        moveString += 'x';
      } else {
        moveString += '-';
      }
      moveString += move.move.to;
      moveString += ' ';
      moveNumber += 1;
    }

    if (moveString.length) {
      moves.push(moveString);
    }

    // TODO resutl from pdn or header??
    if (typeof header.Result !== 'undefined') {
      moves.push(header.Result);
    }

    if (maxWidth === 0) {
      return result.join('') + moves.join(' ');
    }

    var currentWidth = 0;
    for (i = 0; i < moves.length; i++) {
      if (currentWidth + moves[i].length > maxWidth && i !== 0) {
        if (result[result.length - 1] === ' ') {
          result.pop();
        }

        result.push(newline);
        currentWidth = 0;
      } else if (i !== 0) {
        result.push(' ');
        currentWidth++;
      }
      result.push(' ');
      currentWidth += moves[i].length;
    }

    return result.join('');
  }

  function set_header(args) {
    for (var i = 0; i < args.length; i += 2) {
      if (typeof args[i] === 'string' && typeof args[i + 1] === 'string') {
        header[args[i]] = args[i + 1];
      }
    }
    return header;
  }

  /* called when the initial board setup is changed with put() or remove().
   * modifies the SetUp and FEN properties of the header object.  if the FEN is
   * equal to the default position, the SetUp and FEN are deleted
   * the setup is only updated if history.length is zero, ie moves haven't been
   * made.
   */
  function update_setup(fen) {
    if (history.length > 0) {
      return false;
    }
    if (fen !== DEFAULT_FEN) {
      header['SetUp'] = '1';
      header['FEN'] = fen;
      states.push(fen);
    } else {
      delete header['SetUp'];
      delete header['FEN'];
    }
  }

  function parsePDN(pdn, options) {
    var newline_char = (typeof options === 'object' &&
      typeof options.newline_char === 'string')
      ? options.newline_char : '\r?\n';
    var regex = new RegExp('^(\\[(.|' + mask(newline_char) + ')*\\])' +
      '(' + mask(newline_char) + ')*' +
      '1.(' + mask(newline_char) + '|.)*$', 'g');

    function mask(str) {
      return str.replace(/\\/g, '\\');
    }

    function parsePDNHeader(header, options) {
      var headerObj = {};
      var headers = header.split(new RegExp(mask(newline_char)));
      var key = '';
      var value = '';

      for (var i = 0; i < headers.length; i++) {
        key = headers[i].replace(/^\[([A-Z][A-Za-z]*)\s.*\]$/, '$1');
        value = headers[i].replace(/^\[[A-Za-z]+\s"(.*)"\]$/, '$1');
        if (trim(key).length > 0) {
          headerObj[key] = value;
        }
      }

      return headerObj;
    }

    var headerString = pdn.replace(regex, '$1');
    if (headerString[0] !== '[') {
      headerString = '';
    }

    reset();

    var headers = parsePDNHeader(headerString, options);

    for (var key in headers) {
      set_header([key, headers[key]]);
    }

    if (headers['Setup'] === '1') {
      if (!(('FEN' in headers) && load(headers['FEN']))) {
        console.error('fen invalid');
        return false;
      }
    } else {
      position = DEFAULT_POSITION_INTERNAL;
    }

    /* delete header to get the moves */
    var ms = pdn.replace(headerString, '').replace(new RegExp(mask(newline_char), 'g'), ' ');

    /* delete comments */
    ms = ms.replace(/(\{[^}]+\})+?/g, '');

    /* delete recursive annotation variations */
    var rav_regex = /(\([^\(\)]+\))+?/g;
    while (rav_regex.test(ms)) {
      ms = ms.replace(rav_regex, '');
    }

    /* delete move numbers */
    // TODO not working for move numbers with space
    ms = ms.replace(/\d+\./g, '');

    /* delete ... indicating black to move */
    ms = ms.replace(/\.\.\./g, '');

    /* trim and get array of moves */
    var moves = trim(ms).split(new RegExp(/\s+/));

    /* delete empty entries */
    moves = moves.join(',').replace(/,,+/g, ',').split(',');

    var move = '';
    for (var half_move = 0; half_move < moves.length - 1; half_move += 1) {
      move = getMoveObject(moves[half_move]);
      if (!move) {
        return false;
      } else {
        makeMove(move);
      }
    }

    var result = moves[moves.length - 1];
    if (POSSIBLE_RESULTS.indexOf(result) > -1) {
      if (headers['Result'] === 'undefined') {
        set_header(['Result', result]);
      }
    } else {
      move = getMoveObject(result);
      if (!move) {
        return false;
      } else {
        makeMove(move);
      }
    }
    return true;
  }

  function getMoveObject(move) {
    // TODO move flags for both capture and promote??
    var tempMove = {};
    var matches = move.split(/[x|-]/);
    tempMove.from = parseInt(matches[0], 10);
    tempMove.to = parseInt(matches[1], 10);
    var moveType = move.match(/[x|-]/)[0];
    if (moveType === '-') {
      tempMove.flags = FLAGS.NORMAL;
    } else {
      tempMove.flags = FLAGS.CAPTURE;
    }
    tempMove.piece = position.charAt(convertNumber(tempMove.from, 'internal'));
    var moves = getLegalMoves(tempMove.from);
    moves = convertMoves(moves, 'external');
    // if move legal then make move
    for (var i = 0; i < moves.length; i += 1) {
      if (tempMove.to === moves[i].to && tempMove.from === moves[i].from) {
        if (moves[i].takes.length > 0) {
          tempMove.flags = FLAGS.CAPTURE;
          tempMove.captures = moves[i].takes;
          tempMove.takes = moves[i].takes;
          tempMove.piecesCaptured = moves[i].piecesTaken;
        }
        return tempMove;
      }
    }
    console.log(moves, tempMove);
    return false;
  }

  function makeMove(move) {
    move.piece = position.charAt(convertNumber(move.from, 'internal'));
    position = setCharAt(position, convertNumber(move.to, 'internal'), move.piece);
    position = setCharAt(position, convertNumber(move.from, 'internal'), 0);
    move.flags = FLAGS.NORMAL;
    // TODO refactor to either takes or capture
    if (move.takes && move.takes.length) {
      move.flags = FLAGS.CAPTURE;
      move.captures = move.takes;
      move.piecesCaptured = move.piecesTaken;
      for (var i = 0; i < move.takes.length; i++) {
        position = setCharAt(position, convertNumber(move.takes[i], 'internal'), 0);
      }
    }
    // Promoting piece here
    if (move.to <= 5 && move.piece === 'w') {
      move.flags = FLAGS.PROMOTION;
      position = setCharAt(position, convertNumber(move.to, 'internal'), move.piece.toUpperCase());
    } else if (move.to >= 46 && move.piece === 'b') {
      position = setCharAt(position, convertNumber(move.to, 'internal'), move.piece.toUpperCase());
    }

    if (turn === BLACK) {
      number_of_moves += 1;
    }
    turn = swap_color(turn);
    push(move);
  }

  function get(square) {
    var piece = position.charAt(convertNumber(square, 'internal'));
    return piece;
  }

  function put(piece, square) {
    // check for valid piece string
    if (SYMBOLS.match(piece) === null) {
      return false;
    }

    // check for valid square
    if (outsideBoard(convertNumber(square, 'internal')) === true) {
      return false;
    }
    position = setCharAt(position, convertNumber(square, 'internal'), piece);
    let current_fen = generate_fen();
    states.push(current_fen);
    update_setup(current_fen);

    return true;
  }

  function remove(square) {
    var piece = get(square);
    position = setCharAt(position, convertNumber(square, 'internal'), 0);
    let current_fen = generate_fen();
    if (current_fen in states) {
      delete states[current_fen];
    }
    update_setup(generate_fen());

    return piece;
  }

  function build_move(board, from, to, flags, promotion) {
    var move = {
      color: turn,
      from: from,
      to: to,
      flags: flags,
      piece: board[from].type
    };

    if (promotion) {
      move.flags |= BITS.PROMOTION;
    }

    if (board[to]) {
      move.captured = board[to].type;
    } else if (flags & BITS.CAPTURE) {
      move.captured = MAN;
    }
    return move;
  }

  function generate_moves(square) {
    var moves = [];

    if (square) {
      moves = getLegalMoves(square.square);
    } else {
      var tempCaptures = getCaptures();
      // TODO change to be applicable to array
      if (tempCaptures.length) {
        for (var i = 0; i < tempCaptures.length; i++) {
          tempCaptures[i].flags = FLAGS.CAPTURE;
          tempCaptures[i].captures = tempCaptures[i].jumps;
          tempCaptures[i].piecesCaptured = tempCaptures[i].piecesTaken;
        }
        return tempCaptures;
      }
      moves = getMoves();
    }
    // TODO returns [] for on hovering for square no
    moves = [].concat.apply([], moves);
    return moves;
  }

  function getLegalMoves(index) {
    var legalMoves;
    index = parseInt(index, 10);
    if (!Number.isNaN(index)) {
      index = convertNumber(index, 'internal');

      var captures = capturesAtSquare(index, {position: position, dirFrom: ''}, {
        jumps: [index],
        takes: [],
        piecesTaken: []
      });

      captures = longestCapture(captures);
      legalMoves = captures;
      if (captures.length === 0) {
        legalMoves = movesAtSquare(index);
      }
    }
    // TODO called on hover ??
    return convertMoves(legalMoves, 'external');
  }

  function getMoves() {
    let moves = [];
    const us = turn;

    for (let i = 1; i < position.length; i++) {
      if (position[i] === us || position[i] === us.toLowerCase()) {
        let temp_moves = movesAtSquare(i);
        if (temp_moves.length) {
          moves = moves.concat(convertMoves(temp_moves, 'external'));
        }
      }
    }
    return moves;
  }

  function setCharAt(position, idx, chr) {
    idx = parseInt(idx, 10);
    if (idx > position.length - 1) {
      return position.toString();
    } else {
      return position.substr(0, idx) + chr + position.substr(idx + 1);
    }
  }

  function movesAtSquare(square) {
    let moves = [];
    const position_from = square;
    const piece = position.charAt(position_from);
    // console.trace(piece, square, 'movesAtSquare')
    switch (piece) {
      case 'b':
      case 'w': {
        const direction_strings = directionStrings(position, position_from, 2);
        for (const dir in direction_strings) {
          const str = direction_strings[dir];

          const match_array = str.match(/^0/); // e.g. b0 w0
          if (match_array !== null && validDir(piece, dir) === true) {
            const position_to = position_from + STEPS[dir];
            const move_object =
              {from: position_from, to: position_to, takes: [], jumps: []};
            moves.push(move_object);
          }
        }
        break;
      }
      case 'W':
      case 'B': {
        const direction_strings = directionStrings(position, position_from);
        for (const dir in direction_strings) {
          const str = direction_strings[dir];

          const match_array = str.match(/^0+/); // e.g. B000, W0
          if (match_array !== null) {
            for (let i = 1; i <= match_array[0].length; i++) {
              const position_to = position_from + i * STEPS[dir];
              const move_object = {from: position_from, to: position_to, takes: [], jumps: []};
              moves.push(move_object);
            }
          }
        }
        break;
      }
      default:
        return moves;
    }
    return moves;
  }

  function getCaptures() {
    let us = turn;
    let captures = [];
    for (let i = 0; i < position.length; i++) {
      if (position[i] === us || position[i] === us.toLowerCase()) {
        var posFrom = i;
        var state = {position: position, dirFrom: ''};
        var capture = {jumps: [], takes: [], from: posFrom, to: '', piecesTaken: []};
        capture.jumps[0] = posFrom;
        var tempCaptures = capturesAtSquare(posFrom, state, capture);
        if (tempCaptures.length) {
          captures = captures.concat(convertMoves(tempCaptures, 'external'));
        }
      }
    }
    captures = longestCapture(captures);
    return captures;
  }

  function capturesAtSquare(posFrom, state, capture) {
    var piece = state.position.charAt(posFrom);
    if (piece !== 'b' && piece !== 'w' && piece !== 'B' && piece !== 'W') {
      return [capture];
    }
    var dirString;
    if (piece === 'b' || piece === 'w') {
      dirString = directionStrings(state.position, posFrom, 2);
    } else {
      dirString = directionStrings(state.position, posFrom);
    }
    var finished = true;
    var captureArrayForDir = {};
    for (var dir in dirString) {
      if (dir === state.dirFrom) {
        continue;
      }
      var str = dirString[dir];
      switch (piece) {
        case 'b':
        case 'w':
          var matchArray = str.match(/^[wW]0|^[bB]0/); // matches: w0, W0, B0, b0
          if (matchArray !== null && piece !== matchArray[0].charAt(0)) {
            var posTo = posFrom + (2 * STEPS[dir]);
            var posTake = posFrom + (1 * STEPS[dir]);
            if (capture.takes.indexOf(posTake) > -1) {
              continue; // capturing twice forbidden
            }
            var updateCapture = clone(capture);
            updateCapture.to = posTo;
            updateCapture.jumps.push(posTo);
            updateCapture.takes.push(posTake);
            updateCapture.piecesTaken.push(position.charAt(posTake));
            updateCapture.from = posFrom;
            var updateState = clone(state);
            updateState.dirFrom = oppositeDir(dir);
            var pieceCode = updateState.position.charAt(posFrom);
            updateState.position = setCharAt(updateState.position, posFrom, 0);
            updateState.position = setCharAt(updateState.position, posTo, pieceCode);
            finished = false;
            captureArrayForDir[dir] = capturesAtSquare(posTo, updateState, updateCapture);
          }
          break;
        case 'B':
        case 'W':
          matchArray = str.match(/^0*[wW]0+|^0*[bB]0+/); // matches: 00w000, B00
          if (matchArray !== null && piece !== matchArray[0].match(/[wWbB]/)[0].charAt(0)) {
            var matchStr = matchArray[0];
            var matchArraySubstr = matchStr.match(/[wW]0+$|[bB]0+$/); // matches: w000, B00
            var matchSubstr = matchArraySubstr[0];
            var takeIndex = matchStr.length + 1 - matchSubstr.length; // add 1 for current position
            posTake = posFrom + (takeIndex * STEPS[dir]);
            if (capture.takes.indexOf(posTake) > -1) {
              continue;
            }
            for (var i = 1; i < matchSubstr.length; i++) {
              posTo = posFrom + ((takeIndex + i) * STEPS[dir]);
              updateCapture = clone(capture);
              updateCapture.jumps.push(posTo);
              updateCapture.to = posTo;
              updateCapture.takes.push(posTake);
              updateCapture.piecesTaken.push(position.charAt(posTake));
              updateCapture.posFrom = posFrom;
              updateState = clone(state);
              updateState.dirFrom = oppositeDir(dir);
              pieceCode = updateState.position.charAt(posFrom);
              updateState.position = setCharAt(updateState.position, posFrom, 0);
              updateState.position = setCharAt(updateState.position, posTo, pieceCode);
              finished = false;
              var dirIndex = dir + i.toString();
              captureArrayForDir[dirIndex] = capturesAtSquare(posTo, updateState, updateCapture);
            }
          }
          break;
        default:
          captureArrayForDir = [];
      }
    }
    var captureArray = [];
    if (finished === true && capture.takes.length) {
      // fix for mutiple capture
      capture.from = capture.jumps[0];
      captureArray[0] = capture;
    } else {
      for (dir in captureArrayForDir) {
        captureArray = captureArray.concat(captureArrayForDir[dir]);
      }
    }
    return captureArray;
  }

  function push(move) {
    history.push({
      move: move,
      turn: turn,
      moveNumber: number_of_moves
    });
    states.push(generate_fen());
  }

  function undoMove() {
    let old = history.pop();
    let oldState = states.pop();
    if (!old || !oldState) {
      return null;
    }

    var move = old.move;
    turn = old.turn;
    number_of_moves = old.moveNumber;

    position = setCharAt(position, convertNumber(move.from, 'internal'), move.piece);
    position = setCharAt(position, convertNumber(move.to, 'internal'), 0);
    if (move.flags === 'c') {
      for (var i = 0; i < move.captures.length; i += 1) {
        position = setCharAt(position, convertNumber(move.captures[i], 'internal'), move.piecesCaptured[i]);
      }
    } else if (move.flags === 'p') {
      position = setCharAt(position, convertNumber(move.from, 'internal'), move.piece.toLowerCase());
    }
    return move;
  }

  function get_disambiguator(move) {

  }

  function swap_color(c) {
    return c === WHITE ? BLACK : WHITE;
  }

  function isInteger(int) {
    var regex = /^\d+$/;
    if (regex.test(int)) {
      return true;
    } else {
      return false;
    }
  }

  function longestCapture(captures) {
    var maxJumpCount = 0;
    for (var i = 0; i < captures.length; i++) {
      var jumpCount = captures[i].jumps.length;
      if (jumpCount > maxJumpCount) {
        maxJumpCount = jumpCount;
      }
    }

    var selectedCaptures = [];
    if (maxJumpCount < 2) {
      return selectedCaptures;
    }

    for (i = 0; i < captures.length; i++) {
      if (captures[i].jumps.length === maxJumpCount) {
        selectedCaptures.push(captures[i]);
      }
    }
    return selectedCaptures;
  }

  function convertMoves(moves, type) {
    var tempMoves = [];
    if (!type || moves.length === 0) {
      return tempMoves;
    }
    for (var i = 0; i < moves.length; i++) {
      var moveObject = {jumps: [], takes: []};
      moveObject.from = convertNumber(moves[i].from, type);
      for (var j = 0; j < moves[i].jumps.length; j++) {
        moveObject.jumps[j] = convertNumber(moves[i].jumps[j], type);
      }
      for (j = 0; j < moves[i].takes.length; j++) {
        moveObject.takes[j] = convertNumber(moves[i].takes[j], type);
      }
      moveObject.to = convertNumber(moves[i].to, type);
      moveObject.piecesTaken = moves[i].piecesTaken;
      tempMoves.push(moveObject);
    }
    return tempMoves;
  }

  function convertNumber(number, notation) {
    var num = parseInt(number, 10);
    var result;
    switch (notation) {
      case 'internal':
        result = num + Math.floor((num - 1) / 10);
        break;
      case 'external':
        result = num - Math.floor((num - 1) / 11);
        break;
      default:
        result = num;
    }
    return result;
  }

  function convertPosition(position, notation) {
    var sub1, sub2, sub3, sub4, sub5, newPosition;
    switch (notation) {
      case 'internal':
        sub1 = position.substr(1, 10);
        sub2 = position.substr(11, 10);
        sub3 = position.substr(21, 10);
        sub4 = position.substr(31, 10);
        sub5 = position.substr(41, 10);
        newPosition = '-' + sub1 + '-' + sub2 + '-' + sub3 + '-' + sub4 + '-' + sub5 + '-';
        break;
      case 'external':
        sub1 = position.substr(1, 10);
        sub2 = position.substr(12, 10);
        sub3 = position.substr(23, 10);
        sub4 = position.substr(34, 10);
        sub5 = position.substr(45, 10);
        newPosition = '?' + sub1 + sub2 + sub3 + sub4 + sub5;
        break;
      default:
        newPosition = position;
    }
    return newPosition;
  }

  function outsideBoard(square) {
    // internal notation only
    var n = parseInt(square, 10);
    if (n >= 0 && n <= 55 && (n % 11) !== 0) {
      return false;
    } else {
      return true;
    }
  }

// -W0000000b0-0000000000-0000000000-0000000000-0000000000-, 1, 2
  function directionStrings(tempPosition, square, maxLength) {
    // Create direction strings for square at position (internal representation)
    // Output object with four directions as properties (four rhumbs).
    // Each property has a string as value representing the pieces in that direction.
    // Piece of the given square is part of each string.
    // Example of output: {NE: 'b0', SE: 'b00wb00', SW: 'bbb00', NW: 'bb'}
    // Strings have maximum length of given maxLength.
    if (arguments.length === 2) {
      maxLength = 100;
    }

    if (outsideBoard(square) === true) {
      return 334;
    }

    let dirStrings = {};
    for (const [dir, offset] of Object.entries(STEPS)) {
      let dirArray = [];
      let index = square + offset;
      while (!outsideBoard(index) && dirArray.length < maxLength) {
        dirArray.push(tempPosition.charAt(index));
        index += offset;
      }

      dirStrings[dir] = dirArray.join('');
    }

    return dirStrings;
  }

  function oppositeDir(direction) {
    var opposite = {NE: 'SW', SE: 'NW', SW: 'NE', NW: 'SE'};
    return opposite[direction];
  }

  function validDir(piece, dir) {
    var validDirs = {};
    validDirs.w = {NE: true, SE: false, SW: false, NW: true};
    validDirs.b = {NE: false, SE: true, SW: true, NW: false};
    return validDirs[piece][dir];
  }

  function ascii(unicode) {
    var extPosition = convertPosition(position, 'external');
    var s = '\n+-------------------------------+\n';
    var i = 1;
    for (var row = 1; row <= 10; row++) {
      s += '|\t';
      if (row % 2 !== 0) {
        s += '  ';
      }
      for (var col = 1; col <= 10; col++) {
        if (col % 2 === 0) {
          s += '  ';
          i++;
        } else {
          if (unicode) {
            s += ' ' + UNICODES[extPosition[i]];
          } else {
            s += ' ' + extPosition[i];
          }
        }
      }
      if (row % 2 === 0) {
        s += '  ';
      }
      s += '\t|\n';
    }
    s += '+-------------------------------+\n';
    return s;
  }

  function inThreefoldRepetition() {
    // Check if an element occurs three times in 'states' array:
    for (let i = 0; i < states.length; i++) {
      let count = 0;
      for (let j = 0; j < states.length; j++) {
        if (states[i] === states[j]) {
          count++;
        }
      }
      if (count >= 3) {
        return true;
      }
    }

    return false;
  }

  function gameOver() {
    if (inThreefoldRepetition()) {
      return true;
    }
    // First check if any piece left
    for (var i = 0; i < position.length; i++) {
      if (position[i].toLowerCase() === turn.toLowerCase()) {
        // if no moves left or in three fold repetition game over
        return generate_moves().length === 0;
      }
    }
    return true;
  }

  function getHistory(options) {
    var tempHistory = clone(history);
    var moveHistory = [];
    var verbose = (typeof options !== 'undefined' && 'verbose' in options && options.verbose);
    while (tempHistory.length > 0) {
      var move = tempHistory.shift();
      if (verbose) {
        moveHistory.push(makePretty(move));
      } else {
        moveHistory.push(move.move.from + SIGNS[move.move.flags] + move.move.to);
      }
    }

    return moveHistory;
  }

  function getPosition() {
    return convertPosition(position, 'external');
  }

  function makePretty(ugly_move) {
    let move = {};
    move.from = ugly_move.move.from;
    move.to = ugly_move.move.to;
    move.flags = ugly_move.move.flags;
    move.moveNumber = ugly_move.moveNumber;
    move.piece = ugly_move.move.piece;
    if (move.flags === 'c') {
      move.captures = ugly_move.move.captures.join(',');
    }
    return move;
  }

  function clone(obj) {
    const dupe = JSON.parse(JSON.stringify(obj));
    return dupe;
  }

  function trim(str) {
    return str.replace(/^\s+|\s+$/g, '');
  }

  // TODO
  function perft(depth) {
    const moves = generate_moves({legal: false});
    let nodes = 0;

    for (let i = 0; i < moves.length; i++) {
      makeMove(moves[i]);
      if (depth - 1 > 0) {
        const child_nodes = perft(depth - 1);
        nodes += child_nodes;
      } else {
        nodes++;
      }
      undoMove();
    }

    return nodes;
  }

  return {
    WHITE: WHITE,
    BLACK: BLACK,
    MAN: MAN,
    KING: KING,
    FLAGS: FLAGS,
    SQUARES: 'A8',

    load: function (fen) {
      return load(fen);
    },

    reset: function () {
      return reset();
    },

    moves: generate_moves,

    gameOver: gameOver,

    inDraw: function () {
      return false;
    },

    validate_fen: validate_fen,

    fen: generate_fen,

    pdn: generatePDN,

    load_pdn: function (pdn, options) {
    },

    parsePDN: parsePDN,

    header: function () {
      return set_header(arguments);
    },

    ascii: ascii,

    turn: function () {
      return turn.toLowerCase();
    },

    move: function move(move) {
      let to;
      let from;
      if (typeof move === 'string' || move instanceof String) {
        const delimiter = move.search(/-/);
        if (delimiter !== -1) {
          from = +move.substring(0, delimiter);
          to = +move.substring(delimiter + 1, move.length);
        } else {
          return false;
        }
      } else if (typeof move.to !== 'undefined'
        && typeof move.from !== 'undefined') {
        to = +move.to;
        from = +move.from;
      } else {
        return false;
      }

      let moves = generate_moves();
      for (let i = 0; i < moves.length; i++) {
        if ((to === moves[i].to) && (from === moves[i].from)) {
          makeMove(moves[i]);
          return moves[i];
        }
      }
      return false;
    },

    getMoves: getMoves,

    getLegalMoves: getLegalMoves,

    undo: function () {
      const move = undoMove();
      return move || null;
    },

    clear: function () {
      return clear();
    },

    put: function (piece, square) {
      return put(piece, square);
    },

    get: function (square) {
      return get(square);
    },

    remove: function (square) {
      return remove(square);
    },

    perft: function (depth) {
      return perft(depth);
    },

    history: getHistory,

    convertMoves: convertMoves,

    convertNumber: convertNumber,

    convertPosition: convertPosition,

    outsideBoard: outsideBoard,

    directionStrings: directionStrings,

    oppositeDir: oppositeDir,

    validDir: validDir,

    position: getPosition,

    clone: clone,

    makePretty: makePretty,

    captures: getCaptures,

    inThreefoldRepetition: inThreefoldRepetition
  };
};

if (typeof exports !== 'undefined') {
  exports.Draughts = Draughts;
}

if (typeof define !== 'undefined') {
  define(function () {
    return Draughts;
  });
}
