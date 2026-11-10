/*
 * Asset Checkout - form-level script (JScript), fictional sample for InfoPath Afterlife.
 * Same layout as InfoPath 2003 script.js files: one handler per field, named after the node.
 */
XDocument.DOM.setProperty("SelectionNamespaces",
    'xmlns:my="http://schemas.microsoft.com/office/infopath/2003/myXSD/2026-11-04T09:47:00"');

// Upper-case the asset tag after it changes.
function msoxd_my_assetTag::OnAfterChange(eventObj)
{
    if (eventObj.IsUndoRedo || eventObj.Operation != "Insert")
        return;
    var node = eventObj.Site;
    var text = node.text.toUpperCase();
    if (node.text != text)
        node.text = text;
}

// Refuse a return date before the checkout date.
function msoxd_my_returnDue::OnValidate(eventObj)
{
    var out = XDocument.DOM.selectSingleNode("/my:assetCheckoutScript/my:checkoutDate").text;
    if (eventObj.Site.text != "" && out != "" && eventObj.Site.text < out)
        eventObj.ReportError(eventObj.Site, "The return date cannot be before the checkout date.", false);
}
