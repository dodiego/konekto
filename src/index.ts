type PlainJson = {
    [key: string]: string | number | boolean
}

export function plainJsonToCypherNode (plainJson: PlainJson) {
    const cypherParts = Object.entries(plainJson).reduce((cypherParts, [jsonKey, jsonValue]) => {
        if (typeof jsonValue === 'string') {
            cypherParts.push(`${jsonKey}: '${jsonValue}'`)
        } else {
            cypherParts.push(`${jsonKey}: ${jsonValue}`)
        }

        return cypherParts
    }, [])

    return `({
  ${cypherParts.join(',\n  ')}
})`
}
