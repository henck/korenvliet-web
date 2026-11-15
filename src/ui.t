#charset "us-ascii"
#include <adv3.h>
#include <en_us.h>

/*
 *   Data for the web page. Before each command prompt, the game outputs a
 *   tag the page reads (other interpreters ignore it):
 *
 *     <x-ui image="foyer" room="Foyer">
 *
 *   image: the key of the location's picture (roomImage); the page shows
 *          web/images/<key>.jpg (or .png, .webp, ...), or a placeholder
 *          when there's no such file yet; empty for no picture at all
 *   room:  the location's name (for the placeholder)
 *
 *   By default a room's picture key is its object name (foyer, mainStreet,
 *   sewerFork), so a picture is added by dropping images/<name>.jpg into
 *   web/images. A room can choose another picture, also depending on the
 *   game state:
 *
 *     roomImage = (panelledDoorOutside.isOpen ? 'foyer-open' : 'foyer')
 *     roomImage = 'sewer'      // several rooms sharing a picture
 *     roomImage = nil          // no picture
 */

modify Thing
    /* the key of this location's picture, or nil for none */
    roomImage = (objName)

    /* the object's name in the source (set during preinit for rooms) */
    objName = nil
;

/* Give each room its object name (global symbols only exist in preinit). */
roomNamesPreinit: PreinitObject
    execute()
    {
        t3GetGlobalSymbols().forEachAssoc(function(name, val)
        {
            if (dataType(val) == TypeObject && !val.isClass() && val.ofKind(Room))
                val.objName = name;
        });
    }
;

webUI: object
    update()
    {
        local room = gPlayerChar.getOutermostRoom();
        local image = room.roomImage;

        "<x-ui image=\"<<quote(image == nil ? '' : image)>>\"
            room=\"<<quote(room.roomName)>>\">";
    }

    /* text for an attribute value in double quotes */
    quote(str) { return str.findReplace(['&', '"'], ['&amp;', '&quot;']); }
;

webUIInit: InitObject
    execute() { new PromptDaemon(webUI, &update); }
;
