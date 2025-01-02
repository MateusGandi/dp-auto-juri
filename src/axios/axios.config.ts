import axios from 'axios';

export class HTTPRequest {
  async get(url: string) {
    return await axios.get(url);
  }

  async post(url: string, body: any) {
    return await axios.post(url, body);
  }

  async insert(document: string, info: any) {
    const { data } = await axios.get(
      `https://srv488264.hstgr.cloud/conection/mongo?document=${document}`,
    );
    const plusData = data.parametros ? data.parametros : [];
    var formatted = {
      id: data._id,
      parametros: [...plusData, ...info],
    };
    const result = await axios.put(
      `https://srv488264.hstgr.cloud/conection/config`,
      formatted,
    );
    return result.data.parametros;
  }

  async update(document: string, info: any) {
    const { data } = await axios.get(
      `https://srv488264.hstgr.cloud/conection/mongo?document=${document}`,
    );
    var formatted = {
      id: data._id,
      parametros: info,
    };
    const result = await axios.put(
      `https://srv488264.hstgr.cloud/conection/config`,
      formatted,
    );
    return result.data.parametros;
  }

  async queryOne(document: string) {
    try {
      const { data } = await axios.get(
        `https://srv488264.hstgr.cloud/conection/mongo?document=${document}`,
      );
      return data.parametros[0];
    } catch (error) {
      return [];
    }
  }

  async query(document: string) {
    try {
      const { data } = await axios.get(
        `https://srv488264.hstgr.cloud/conection/mongo?document=${document}`,
      );
      return data.parametros;
    } catch (error) {
      return [];
    }
  }

  async delete(id: string, idObject: string) {
    try {
      const { data } = await axios.delete(
        `https://srv488264.hstgr.cloud/conection/config?id=${id}&objectId=${idObject}`,
      );
      return data;
    } catch (error) {
      throw new Error(error);
    }
  }
}
