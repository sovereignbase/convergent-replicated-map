const example = {
  values: new Map([
    [
      'givenName',
      {
        uuidv7: '019d81fd-a1e9-76dd-aaf0-f4dd2ac2accc',
        value: { key: 'givenName', value: 'Jori' },
        predecessor: '019d81fd-a1e8-72a8-bfc3-a4b6160544fc',
      },
    ],
    [
      'familyName',
      {
        uuidv7: '019d81fd-a1ea-75cf-b513-f35976cefc93',
        value: { key: 'familyName', value: 'Lehtinen' },
        predecessor: '019d81fd-a1e9-76dd-aaf0-f2cdabfac485',
      },
    ],
  ]),
  relations: new Map([
    ['019d81fd-a1e9-76dd-aaf0-f4dd2ac2accc', 'givenName'],
    ['019d81fd-a1ea-75cf-b513-f35976cefc93', 'familyName'],
  ]),
  tombstones: new Set([
    '019d81fd-a1e8-72a8-bfc3-a08e44d1211e',
    '019d81fd-a1e8-72a8-bfc3-a4b6160544fc',
    '019d81fd-a1e8-72a8-bfc3-a8082418f62a',
    '019d81fd-a1e9-76dd-aaf0-f2cdabfac485',
  ]),
  predecessors: new Set([
    '019d81fd-a1e8-72a8-bfc3-a4b6160544fc',
    '019d81fd-a1e9-76dd-aaf0-f2cdabfac485',
  ]),
}
