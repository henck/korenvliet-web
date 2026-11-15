#charset "utf-8"
#include <adv3.h>
#include <en_us.h>

/*
 *   Debugging verbs, only in debug builds (t3make -d):
 *
 *   FETCH <object>             put any object in the game in your inventory
 *   TELEPORT/GOTO <room>       go to a room, by its object name (beach,
 *                              oceanMiddle) or its room name (Tiny Islet);
 *                              any part of either will do
 */
#ifdef __DEBUG

/* ------------------------------------------------------------------------ */
/*
 *   FETCH: every object in the game is in scope.
 */
DefineTAction(Fetch)
    cacheScopeList()
    {
        local v = new Vector(256);
        for (local obj = firstObj(Thing); obj != nil; obj = nextObj(obj, Thing))
            if (!obj.ofKind(NonPortable) || obj.isIn(gActor.getOutermostRoom()))
                v.append(obj);
        scope_ = v.toList();
    }
;

VerbRule(Fetch)
    'fetch' singleDobj
    : FetchAction
    verbPhrase = 'fetch/fetching (what)'
;

modify Thing
    dobjFor(Fetch)
    {
        verify()
        {
            if (ofKind(Room))
                illogical('That\'s a room. Use TELEPORT to go there. ');
            else if (self == gActor || gActor.isIn(self))
                illogical('You can\'t fetch that. ');
            else if (ofKind(NonPortable))
                illogical('{The dobj/he} {is} fixed in place. ');
            else if (isIn(gActor))
                illogicalAlready('You already have that. ');
        }
        action()
        {
            moveInto(gActor);
            "Fetched: <<theName>>. ";
        }
    }
;

/* ------------------------------------------------------------------------ */
/*
 *   TELEPORT/GOTO: the rooms and their object names are collected during
 *   preinit (global symbols are only available then).
 */
debugRooms: PreinitObject
    rooms = []      /* [symbol name, room] pairs */
    execute()
    {
        local lst = [];
        t3GetGlobalSymbols().forEachAssoc(function(name, val)
        {
            if (dataType(val) == TypeObject && !val.isClass() && val.ofKind(Room))
                lst += [[name, val]];
        });
        rooms = lst.sort(SortAsc, {a, b: a[1].compareIgnoreCase(b[1])});
    }

    /* the rooms matching txt: exact matches if there are any, else partial */
    find(txt)
    {
        local exact = rooms.subset(
            {r: r[1].toLower() == txt || r[2].roomName.toLower() == txt});
        if (exact.length() > 0)
            return exact;
        return rooms.subset(
            {r: r[1].toLower().find(txt) != nil
                || r[2].roomName.toLower().find(txt) != nil});
    }

    list(lst)
    {
        foreach (local r in lst)
            "\n\t<<r[1]>> (<<r[2].roomName>>)";
    }
;

DefineLiteralAction(Teleport)
    execAction()
    {
        local txt = rexReplace('^<space>+|<space>+$', getLiteral().toLower(), '', ReplaceAll);
        local found = debugRooms.find(txt);
        if (txt == '' || found.length() == 0)
        {
            "No room matches <q><<getLiteral()>></q>. The rooms are:";
            debugRooms.list(debugRooms.rooms);
            "\n";
            return;
        }
        if (found.length() > 1)
        {
            "Which room do you mean?";
            debugRooms.list(found);
            "\n";
            return;
        }
        gActor.moveIntoForTravel(found[1][2]);
        gActor.lookAround(true);
    }
;

VerbRule(Teleport)
    ('teleport' | 'goto') singleLiteral
    : TeleportAction
    verbPhrase = 'teleport/teleporting (where)'
;

#endif /* __DEBUG */
