import requests

def readAndPrintSecretChar(url):
    web_responce = requests.get(url)
    if web_responce.status_code != 200:
        return "Error inaccessible URL!"

    html = web_responce.text
    htmlRows = html.split('<tr')
    noneHeaderRows = htmlRows[2:]
    shapesWithCoords = []
    maxY = 0
    maxX = 0

    for row in noneHeaderRows:
        cells = row.split('<td')
        shape = []
        cellNum = 0;

        for cell in cells:
            span_items = cell.split('<span')

            for span in span_items:

                if '>' in span:
                    cellText = span.split('>')[1].split('<')[0].strip()

                    if cellText:
                        cellText = cellText if cellNum == 1 else int(cellText)
                        shape.append(cellText)
                        if cellNum == 0 and cellText > maxX:
                            maxX = cellText
                        if cellNum == 2 and cellText > maxY:
                            maxY = cellText

                        cellNum = cellNum + 1

        shapesWithCoords.append(shape)

    result = [[" " for _ in range(maxX + 1)] for _ in range(maxY + 1)]
    for shape in shapesWithCoords:
         result[shape[2]][shape[0]] = shape[1]
    result.reverse()

    for item in result:
        print("".join(item))

    return
    # return shapesWithCoords

url = "https://docs.google.com/document/d/e/2PACX-1vSvM5gDlNvt7npYHhp_XfsJvuntUhq184By5xO_pA4b_gCWeXb6dM6ZxwN8rE6S4ghUsCj2VKR21oEP/pub"
readAndPrintSecretChar(url)
