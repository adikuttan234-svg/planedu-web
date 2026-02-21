const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '../data/db.json');

// Ensure data directory exists
if (!fs.existsSync(path.dirname(DB_FILE))) {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
}

// Initialize DB file if not exists
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({
        users: [],
        faculties: [],
        subjects: [],
        schedules: [],
        deadlines: [],
        rooms: [],
        leaveRequests: [],
        logs: []
    }, null, 2));
}

class LocalModel {
    constructor(collectionName, schema) {
        this.collectionName = collectionName;
    }

    _readDB() {
        return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    }

    _writeDB(data) {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    }

    async find(query = {}) {
        const db = this._readDB();
        let results = db[this.collectionName] || [];

        return results.filter(item => {
            for (let key in query) {
                // Use loose equality for IDs or general flexibility
                if (item[key] != query[key]) return false;
            }
            return true;
        });
    }

    async findOne(query) {
        const results = await this.find(query);
        return results[0] || null;
    }

    async findById(id) {
        return await this.findOne({ _id: id });
    }

    async findByIdAndDelete(id) {
        const db = this._readDB();
        const list = db[this.collectionName] || [];
        const index = list.findIndex(item => item._id === id);

        if (index !== -1) {
            list.splice(index, 1);
            db[this.collectionName] = list;
            this._writeDB(db);
        }
        return true;
    }

    async findOneAndUpdate(query, update, options) {
        const db = this._readDB();
        let list = db[this.collectionName] || [];
        let itemIndex = list.findIndex(item => {
            for (let key in query) {
                if (item[key] != query[key]) return false;
            }
            return true;
        });

        let item;
        if (itemIndex === -1 && options.upsert) {
            item = { _id: Date.now().toString(), ...query, ...update };
            list.push(item);
        } else if (itemIndex !== -1) {
            item = { ...list[itemIndex], ...update };
            list[itemIndex] = item;
        } else {
            return null;
        }

        db[this.collectionName] = list;
        this._writeDB(db);
        return item;
    }
}

class LocalDocument {
    constructor(model, data) {
        this.model = model;
        this.data = data;
    }

    async save() {
        const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        const collection = this.model.collectionName;
        if (!db[collection]) db[collection] = [];

        // Assign ID if new
        if (!this.data._id) {
            this.data._id = Date.now().toString();
        }

        // Check if exists to update, else push
        const index = db[collection].findIndex(i => i._id === this.data._id);
        if (index !== -1) {
            db[collection][index] = this.data;
        } else {
            db[collection].push(this.data);
        }

        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
        return this.data;
    }
}

// Factory function to mimic Mongoose model
const createModel = (name, collectionName) => {
    const modelInstance = new LocalModel(collectionName);

    // The class itself handles 'new Model(data)'
    const ModelClass = class {
        constructor(data) {
            return new LocalDocument(modelInstance, data);
        }
        static find = (q) => modelInstance.find(q);
        static findOne = (q) => modelInstance.findOne(q);
        static findById = (id) => modelInstance.findById(id);
        static findByIdAndDelete = (id) => modelInstance.findByIdAndDelete(id);
        static findOneAndUpdate = (q, u, o) => modelInstance.findOneAndUpdate(q, u, o);
    };

    return ModelClass;
}

module.exports = {
    User: createModel('User', 'users'),
    Faculty: createModel('Faculty', 'faculties'),
    Subject: createModel('Subject', 'subjects'),
    Schedule: createModel('Schedule', 'schedules'),
    Room: createModel('Room', 'rooms'),
    LeaveRequest: createModel('LeaveRequest', 'leaveRequests'),
    Deadline: createModel('Deadline', 'deadlines'),
    Log: createModel('Log', 'logs')
};
