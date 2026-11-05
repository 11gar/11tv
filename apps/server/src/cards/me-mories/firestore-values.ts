/**
 * Valeurs de l'API REST de Firestore (https://firebase.google.com/docs/firestore/reference/rest/v1/Value),
 * converties en valeurs JavaScript simples. Les horodatages restent des chaînes ISO : ce
 * module n'en a pas besoin autrement.
 */
export type FirestoreValue =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { stringValue: string }
  | { timestampValue: string }
  | { mapValue: { fields?: Record<string, FirestoreValue> } }
  | { arrayValue: { values?: FirestoreValue[] } }
  | Record<string, unknown>;

export interface FirestoreDocument {
  /** projects/<p>/databases/(default)/documents/users/<uid>/todos/<id> */
  name: string;
  fields?: Record<string, FirestoreValue>;
}

export function decodeValue(value: FirestoreValue): unknown {
  if ('nullValue' in value) return null;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('stringValue' in value) return value.stringValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('mapValue' in value) {
    const map = value.mapValue as { fields?: Record<string, FirestoreValue> };
    return decodeFields(map.fields);
  }
  if ('arrayValue' in value) {
    const array = value.arrayValue as { values?: FirestoreValue[] };
    return (array.values ?? []).map(decodeValue);
  }
  return undefined; // Types sans usage ici (références, géopoints, octets).
}

export function decodeFields(fields: Record<string, FirestoreValue> | undefined) {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields ?? {})) result[key] = decodeValue(value);
  return result;
}

/** Document décodé, avec son identifiant (dernier segment du nom). */
export function decodeDocument(doc: FirestoreDocument): Record<string, unknown> & { id: string } {
  return { ...decodeFields(doc.fields), id: doc.name.slice(doc.name.lastIndexOf('/') + 1) };
}
