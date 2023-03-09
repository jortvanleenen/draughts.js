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
    // TODO, refactor: var EMPTY = -1
    const MAN = 'b';
    const KING = 'w';
    const SYMBOLS = 'bwBW';
    const DEFAULT_FEN = 'W:W31-50:B1-20';
    let position;
    const DEFAULT_POSITION_INTERNAL = '-bbbbbbbbbb-bbbbbbbbbb-0000000000-wwwwwwwwww-wwwwwwwwww-';
    const DEFAULT_POSITION_EXTERNAL = 'Wbbbbbbbbbbbbbbbbbbbb0000000000wwwwwwwwwwwwwwwwwwww';
    const STEPS = {NE: -5, SE: 6, SW: 5, NW: -6};
    const POSSIBLE_RESULTS = ['2-0', '0-2', '1-1', '0-0', '1-0', '0-1', '1/2-1/2'];
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

    function sign(flag) {
        return flag === 'c' ? 'x' : '-';
    }

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
        update_setup(generateFen());
    }

    function reset() {
        load(DEFAULT_FEN);
    }

    function load(fen) {
        // TODO for default fen
        if (!fen || fen === DEFAULT_FEN) {
            position = DEFAULT_POSITION_INTERNAL;
            update_setup(generateFen(position));
            return true;
        }
        // fen_constants(dimension) //TODO for empty fens

        const validated_fen = validateFen(fen);
        if (!validated_fen.valid) {
            console.error('Fen Error', fen, validated_fen);
            return false;
        }
        if (position) {
            clear();
        }

        // Remove spaces
        fen = fen.replace(/\s+/g, '');
        // Remove suffixes
        fen.replace(/\..*$/, '');

        const tokens = fen.split(':');
        // Which side to move
        turn = tokens[0][0];

        // var positions = new Array()
        var external_position = DEFAULT_POSITION_EXTERNAL;
        for (var i = 1; i <= external_position.length; i++) {
            external_position = setCharAt(external_position, i, 0);
        }
        external_position = setCharAt(external_position, 0, turn);
        // TODO refactor
        for (var k = 1; k <= 2; k++) {
            // TODO called twice
            var color = tokens[k].substr(0, 1);
            var side_string = tokens[k].substr(1);
            if (side_string.length === 0) continue;
            var numbers = side_string.split(',');
            for (i = 0; i < numbers.length; i++) {
                var square_number = numbers[i];
                var is_king = (square_number.substr(0, 1) === 'K');
                square_number = (is_king === true ? square_number.substr(1) : square_number); // strip K
                var range = square_number.split('-');
                if (range.length === 2) {
                    var from = parseInt(range[0], 10);
                    var to = parseInt(range[1], 10);
                    for (var j = from; j <= to; j++) {
                        external_position = setCharAt(external_position, j, (is_king === true ? color.toUpperCase() : color.toLowerCase()));
                    }
                } else {
                    square_number = parseInt(square_number, 10);
                    external_position = setCharAt(external_position, square_number, (is_king === true ? color.toUpperCase() : color.toLowerCase()));
                }
            }
        }

        position = convertPosition(external_position, 'internal');
        update_setup(generateFen(position));

        return true;
    }

    function validateFen(fen) {
        const errors = [
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

        // Fen should be 3 sections separated by colons
        var parts = fen.split(':');
        if (parts.length !== 3) {
            return {valid: false, error: errors[2], fen: fen};
        }

        // Which side to move
        var turnColor = parts[0];
        if (turnColor !== 'B' && turnColor !== 'W' && turnColor !== '?') {
            return {valid: false, error: errors[3], fen: fen};
        }

        // Check colors of both sides
        var colors = parts[1].substr(0, 1) + parts[2].substr(0, 1);
        if (colors !== 'BW' && colors !== 'WB') {
            return {valid: false, error: errors[4], fen: fen};
        }

        // Check parts for both sides
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

    function generateFen() {
        let black = [];
        let white = [];
        const external_position = convertPosition(position, 'external');
        for (let i = 0; i < external_position.length; i++) {
            switch (external_position[i]) {
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

    function generatePdn(options) {
        // for html usage {maxWidth: 72, newline_char: "<br />"}
        var newline = (typeof options === 'object' && typeof options.newline_char === 'string')
            ? options.newline_char : '\n';
        let result = [];

        let header_exists = false;
        for (let i in header) {
            result.push('[' + i + ' "' + header[i] + '"]' + newline);
            header_exists = true;
        }

        if (header_exists && history.length) {
            result.push(newline);
        }
        let temp_history = history.copy;
        let temporary_history = clone(history);
        let move_string = '';
        let move_number = 1;
        while (temporary_history.length > 0) {
            let move = temporary_history.shift();
            if (move.turn === 'W') {
                move_string += move_number + '. ';
            }
            move_string += move.move.from;
            if (move.move.flags === 'c') {
                move_string += 'x';
            } else {
                move_string += '-';
            }
            move_string += move.move.to;
            move_string += ' ';
            move_number += 1;
        }

        let moves = [];
        if (move_string.length) {
            moves.push(move_string);
        }

        // TODO resutl from pdn or header??
        if (typeof header.Result !== 'undefined') {
            moves.push(header.Result);
        }

        const max_width = (typeof options === 'object' && typeof options.maxWidth === 'number')
            ? options.maxWidth : 0;
        if (max_width === 0) {
            return result.join('') + moves.join(' ');
        }

        let current_width = 0;
        for (let i = 0; i < moves.length; i++) {
            if (current_width + moves[i].length > max_width && i !== 0) {
                if (result[result.length - 1] === ' ') {
                    result.pop();
                }

                result.push(newline);
                current_width = 0;
            } else if (i !== 0) {
                result.push(' ');
                current_width++;
            }
            result.push(' ');
            current_width += moves[i].length;
        }

        return result.join('');
    }

    function set_header(args) {
        for (let i = 1; i < args.length; i += 2) {
            if (typeof args[i - 1] === 'string' && typeof args[i] === 'string') {
                header[args[i - 1]] = args[i];
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

    function parsePdn(pdn, options) {
        const newline_char = (typeof options === 'object' &&
            typeof options.newline_char === 'string')
            ? options.newline_char : '\r?\n';

        const newline_regex_masked = newline_char.replace(/\\/g, '\\');

        // Remove all line comments and their line, e.g. %comment<newline_char> -> ''
        const line_comment_regex = new RegExp('%.*' + newline_regex_masked, 'g');
        pdn = pdn.replace(line_comment_regex, '');

        // Delete all inline comments, e.g. {comment} -> ''
        pdn = pdn.replace(/(\{[^}]*})/g, ''); // /(\{[^}]+})+?/g

        function parsePDNHeader(header) {
            let header_object = {};
            const headers = header.split(new RegExp(newline_regex_masked));

            let key = '';
            let value = '';
            for (const element of headers) {
                key = element.match(/[A-Z]\w*/)[0];
                value = element.match(/"(.*)"/)[1];
                if (key.trim().length > 0) {
                    header_object[key] = value;
                }
            }

            return header_object;
        }


        const regex = new RegExp('^(\\[(.|' + newline_regex_masked + ')*\\])' +
            '(' + newline_regex_masked + ')*' +
            '1.(' + newline_regex_masked + '|.)*$', 'g');
        let header_string = pdn.replace(regex, '$1');
        if (header_string[0] !== '[') {
            header_string = '';
        }

        reset();

        const headers = parsePDNHeader(header_string); // , options) if refactor?;

        for (const key in headers) {
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

        // Remove header information, only leaving the moves
        let pdn_moves = pdn.replace(header_string, '');

        // Remove all variation information
        pdn_moves = pdn_moves.replace(/(\(.*\))+/g, '');

        // Remove move numbers, e.g. '1. ' -> '' or '1... ' -> ''
        pdn_moves = pdn_moves.replace(new RegExp(newline_regex_masked, 'g'), ' ');
        pdn_moves = pdn_moves.replace(/\d+\.+ */g, '');

        // Remove strength information
        // Note that strength information enclosed by parentheses is already deleted during the removal of variations
        // This behaviour should probably be changed
        pdn_moves = pdn_moves.replace(/[!?]+/g, '');
        // Removes NAGs
        pdn_moves = pdn_moves.replace(/\$\S+/g, '');

        // Remove game separator
        pdn_moves = pdn_moves.replace(/\*$/g, '');

        // Remove unknown moves, e.g. '...' -> ''
        pdn_moves = pdn_moves.replace(/\.\.\./g, '');

        // Get an array containing every move as element
        let moves = pdn_moves.split(' ');
        moves = moves.filter(function (element) {
            return element !== '';
        });

        // Check if the last element is a result, update the header accordingly if so and remove it from moves
        const result = moves[moves.length - 1];
        if (POSSIBLE_RESULTS.indexOf(result) !== -1) {
            if (headers['Result'] === 'undefined') {
                set_header(['Result', result]);
            }
            moves.pop();
        }

        for (const m of moves) {
            if (!move(m)) {
                return false;
            }
        }
        return true;
    }

    // function getMoveObject(move) {
    //     // TODO move flags for both capture and promote??
    //     const temp_move = {};
    //     const matches = move.split(/[x|-]/);
    //     temp_move.from = parseInt(matches[0], 10);
    //     temp_move.to = parseInt(matches[1], 10);
    //     const move_type = move.match(/[x|-]/)[0];
    //     if (move_type === '-') {
    //         temp_move.flags = FLAGS.NORMAL;
    //     } else {
    //         temp_move.flags = FLAGS.CAPTURE;
    //     }
    //     temp_move.piece = position.charAt(convertNumber(temp_move.from, 'internal'));
    //     let moves = getLegalMoves(temp_move.from);
    //     moves = convertMoves(moves, 'external');
    //     // If move legal then make move
    //     for (const element of moves) {
    //         if (temp_move.to === element.to && temp_move.from === element.from) {
    //             if (element.takes.length > 0) {
    //                 temp_move.flags = FLAGS.CAPTURE;
    //                 temp_move.captures = element.takes;
    //                 temp_move.takes = element.takes;
    //                 temp_move.pieces_captured = element.pieces_taken;
    //             }
    //             return temp_move;
    //         }
    //     }
    //     return false;
    // }

    function move(move) {
        let to;
        let from;
        if (typeof move === 'string' || move instanceof String) {
            const delimiter = move.search(/[-|x]/);
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

        let moves = generateMoves();
        for (const element of moves) {
            if ((to === element.to) && (from === element.from)) {
                makeMove(element);
                return element;
            }
        }
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
            move.pieces_captured = move.pieces_taken;
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

        if (turn === BLACK) { // Full moves are counted
            number_of_moves += 1;
        }
        push(move);
        turn = swap_color(turn);
    }

    function get(square) {
        var piece = position.charAt(convertNumber(square, 'internal'));
        return piece;
    }

    function put(piece, square) {
        // Check for valid piece string
        if (SYMBOLS.match(piece) === null) {
            return false;
        }

        // Check for valid square
        if (outsideBoard(convertNumber(square, 'internal')) === true) {
            return false;
        }
        position = setCharAt(position, convertNumber(square, 'internal'), piece);
        let current_fen = generateFen();
        states.push(current_fen);
        update_setup(current_fen);

        return true;
    }

    function remove(square) {
        var piece = get(square);
        position = setCharAt(position, convertNumber(square, 'internal'), 0);
        let current_fen = generateFen();
        if (current_fen in states) {
            delete states[current_fen];
        }
        update_setup(generateFen());

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

    function generateMoves(square) {
        let moves = [];

        if (square) {
            moves = getLegalMoves(square.square);
        } else {
            let all_captures = getCaptures();
            // TODO change to be applicable to array
            if (all_captures.length) {
                for (const capture of all_captures) {
                    capture.flags = FLAGS.CAPTURE;
                    capture.captures = capture.jumps;
                    capture.pieces_captured = capture.pieces_taken;
                }
                return all_captures;
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
                pieces_taken: []
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
                    if (match_array !== null && isValidDiskDirection(piece, dir) === true) {
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
                const position_from = i;
                const state = {position: position, dirFrom: ''};
                const capture = {jumps: [], takes: [], from: position_from, to: '', pieces_taken: []};
                capture.jumps[0] = position_from;
                const possible_captures = capturesAtSquare(position_from, state, capture);
                if (possible_captures.length) {
                    captures = captures.concat(convertMoves(possible_captures, 'external'));
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
                    if (matchArray !== null && piece !== matchArray[0].charAt(0).toLowerCase()) {
                        var posTo = posFrom + (2 * STEPS[dir]);
                        var posTake = posFrom + (1 * STEPS[dir]);
                        if (capture.takes.indexOf(posTake) > -1) {
                            continue; // capturing twice forbidden
                        }
                        var updateCapture = clone(capture);
                        updateCapture.to = posTo;
                        updateCapture.jumps.push(posTo);
                        updateCapture.takes.push(posTake);
                        updateCapture.pieces_taken.push(position.charAt(posTake));
                        updateCapture.from = posFrom;
                        var updateState = clone(state);
                        updateState.dirFrom = getOppositeDirection(dir);
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
                    if (matchArray !== null && piece !== matchArray[0].match(/[wWbB]/)[0].charAt(0).toUpperCase()) {
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
                            updateCapture.pieces_taken.push(position.charAt(posTake));
                            updateCapture.posFrom = posFrom;
                            updateState = clone(state);
                            updateState.dirFrom = getOppositeDirection(dir);
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
            move_number: number_of_moves
        });
        states.push(generateFen());
    }

    function undoMove() {
        let old = history.pop();
        let old_state = states.pop();
        if (!old || !old_state) {
            return null;
        }

        const move = old.move;
        turn = old.turn;
        number_of_moves = old.move_number;

        position = setCharAt(position, convertNumber(move.from, 'internal'), move.piece);
        position = setCharAt(position, convertNumber(move.to, 'internal'), 0);
        if (move.flags === 'c') {
            for (let i = 0; i < move.captures.length; i++) {
                position = setCharAt(position, convertNumber(move.captures[i], 'internal'), move.pieces_captured[i]);
            }
        } else if (move.flags === 'p') {
            position = setCharAt(position, convertNumber(move.from, 'internal'), move.piece.toLowerCase());
        }
        return move;
    }

    // TODO?
    // function get_disambiguator(move) {
    //
    // }

    function swap_color(c) {
        return c === WHITE ? BLACK : WHITE;
    }

    function isInteger(int) {
        const regex = /^\d+$/;
        return regex.test(int);
    }

    function longestCapture(captures) {
        let longest_jump_count = 0;
        for (let i = 0; i < captures.length; i++) {
            const current_jump_count = captures[i].jumps.length;
            if (current_jump_count > longest_jump_count) {
                longest_jump_count = current_jump_count;
            }
        }

        let allowed_captures = [];
        if (longest_jump_count < 2) {
            return allowed_captures;
        }

        for (let i = 0; i < captures.length; i++) {
            if (captures[i].jumps.length === longest_jump_count) {
                allowed_captures.push(captures[i]);
            }
        }
        return allowed_captures;
    }

    function convertMoves(moves, type) {
        let converted_moves = [];
        if (!type || moves.length === 0) {
            return converted_moves;
        }
        for (let i = 0; i < moves.length; i++) {
            let move_object = {jumps: [], takes: []};
            move_object.from = convertNumber(moves[i].from, type);
            for (let j = 0; j < moves[i].jumps.length; j++) {
                move_object.jumps[j] = convertNumber(moves[i].jumps[j], type);
            }
            for (let j = 0; j < moves[i].takes.length; j++) {
                move_object.takes[j] = convertNumber(moves[i].takes[j], type);
            }
            move_object.to = convertNumber(moves[i].to, type);
            move_object.pieces_taken = moves[i].pieces_taken;
            converted_moves.push(move_object);
        }
        return converted_moves;
    }

    function convertNumber(number, wanted_notation) {
        const num = parseInt(number, 10);
        let result;
        switch (wanted_notation) {
            case 'internal':
                result = num + Math.floor((num - 1) / 10);
                break;
            case 'external':
                result = num - Math.floor((num - 1) / 11);
                break;
            default:
                throw new Error('convertNumber - Unknown notation: ' + wanted_notation);
        }
        return result;
    }

    /**
     * Convert an internal position to an external position or vice versa.
     *
     * @pre position its notation is valid and not equal to the wanted notation
     * @param position the position to convert
     * @param wanted_notation the wanted notation ('internal' or 'external')
     * @returns {*}
     * @since 1.0.0
     */
    function convertPosition(position, wanted_notation) {
        // Internal e.g.: '-bbbbbbbbbb-bbbbbbbbbb-0000000000-wwwwwwwwww-wwwwwwwwww-'
        // External e.g.: 'Wbbbbbbbbbbbbbbbbbbbb0000000000wwwwwwwwwwwwwwwwwwww'
        let converted_position;
        switch (wanted_notation) {
            case 'internal':
                // Internal notation does not keep track of the turn
                position = position.substring(1);
                converted_position = '-' + position.replace(/(.{10})/g, '$1-');
                break;
            case 'external':
                converted_position = '?' + position.replace(/-/g, '');
                break;
            default:
                throw new Error('convertPosition Unknown notation: ' + wanted_notation);
        }
        return converted_position;
    }

    function outsideBoard(square) {
        // Internal notation only
        const n = parseInt(square, 10);
        return !(n >= 0 && n <= 55 && (n % 11) !== 0);
    }

// -W0000000b0-0000000000-0000000000-0000000000-0000000000-, 1, 2
    function directionStrings(current_position, square, max_length) {
        // Create direction strings for square at position (internal representation)
        // Output object with four directions as properties (four rhumbs).
        // Each property has a string as value representing the pieces in that direction.
        // Piece of the given square is part of each string.
        // Example of output: {NE: 'b0', SE: 'b00wb00', SW: 'bbb00', NW: 'bb'}
        // Strings have maximum length of given max_length.
        if (arguments.length === 2) {
            max_length = 100;
        }

        if (outsideBoard(square) === true) {
            return 334;
        }

        let direction_strings = {};
        for (const [dir, offset] of Object.entries(STEPS)) {
            let direction_array = [];
            let index = square + offset;
            while (!outsideBoard(index) && direction_array.length < max_length) {
                direction_array.push(current_position.charAt(index));
                index += offset;
            }

            direction_strings[dir] = direction_array.join('');
        }

        return direction_strings;
    }

    function getOppositeDirection(direction) {
        return {NE: 'SW', SE: 'NW', SW: 'NE', NW: 'SE'}[direction];
    }

    function isValidDiskDirection(piece, dir) {
        return (piece === 'b' && dir[0] === 'S' || piece === 'w' && dir[0] === 'N');
    }

    function ascii(unicode) {
        const external_position = convertPosition(position, 'external');
        let output = '\n+----------------------------+\n';
        let position_index = 1;
        for (let row = 1; row <= 10; row++) {
            output += '|   ';
            if (row % 2 !== 0) {
                output += '  ';
            }
            for (let col = 1; col <= 10; col++) {
                if (col % 2 === 0) {
                    output += '  ';
                    position_index++;
                } else {
                    if (unicode) {
                        output += ' ' + UNICODES[external_position[position_index]];
                    } else {
                        output += ' ' + external_position[position_index];
                    }
                }
            }
            if (row % 2 === 0) {
                output += '  ';
            }
            output += '   |\n';
        }
        output += '+----------------------------+\n';
        return output;
    }

    function inThreefoldRepetition() {
        for (const state of states) {
            let count = 0;
            for (const other_state of states) {
                if (state === other_state) {
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
        for (let i = 0; i < position.length; i++) {
            if (position[i].toLowerCase() === turn.toLowerCase()) {
                // If no moves left or in threefold repetition game over
                return generateMoves().length === 0;
            }
        }
        return true;
    }

    function getHistory(options) {
        let history_copy = clone(history);
        let move_history = [];
        const verbose = (typeof options !== 'undefined' && 'verbose' in options && options.verbose);
        while (history_copy.length > 0) {
            const move = history_copy.shift();
            if (verbose) {
                move_history.push(makePretty(move));
            } else {
                move_history.push(move.move.from + sign(move.move.flags) + move.move.to);
            }
        }

        return move_history;
    }

    function getPosition() {
        return convertPosition(position, 'external');
    }

    function makePretty(ugly_move) {
        let move = {};
        move.from = ugly_move.move.from;
        move.to = ugly_move.move.to;
        move.flags = ugly_move.move.flags;
        move.move_number = ugly_move.move_number;
        move.piece = ugly_move.move.piece;
        if (move.flags === 'c') {
            move.captures = ugly_move.move.captures.join(',');
        }
        return move;
    }

    function clone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    function trim(str) {
        return str.replace(/^\s+|\s+$/g, '');
    }

    // TODO
    function perft(depth) {
        const moves = generateMoves({legal: false});
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

        reset: reset,

        moves: generateMoves,

        gameOver: gameOver,

        inDraw: function () {
            return false;
        },

        validateFen: validateFen,

        fen: generateFen,

        pdn: generatePdn,

        parsePdn: parsePdn,

        header: function () {
            return set_header(arguments);
        },

        ascii: ascii,

        turn: function () {
            return turn.toLowerCase();
        },

        move: move,

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

        getOppositeDirection: getOppositeDirection,

        isValidDiskDirection: isValidDiskDirection,

        position: getPosition,

        clone: clone,

        makePretty: makePretty,

        captures: getCaptures,

        inThreefoldRepetition: inThreefoldRepetition
    };
};

if (typeof exports !== 'undefined') exports.Draughts = Draughts;