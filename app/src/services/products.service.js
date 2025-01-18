const registry = require('./registry.service');
const path = require('path');
const XLSX = require("xlsx");
const XLSX_CALC = require("xlsx-calc");
const formulajs = require("@formulajs/formulajs");
XLSX_CALC.import_functions(formulajs, { override: true });
const { keyValueArraysToObject } = require("../utils/common.utils");

module.exports = {
    getProductConfigured,
    getParamConfig,
};

function getProductConfigured(name, configPath, strict = false) {
    if (!registry.findByNameAndType(name, 'product')?.enabled) return null;

    const product = structuredClone(getProductDefinition(name));
    const config = getParamConfig(product, configPath);

    if (!verifyProductConfig(product, config))
        if (strict) return null;
        else fixProductConfig(product, config)

    const { xcalc } = product;
    const xdoc_path = path.resolve(__dirname, `../../data/products/${xcalc.document}`);
    const workbook = XLSX.readFile(xdoc_path);
    const sheet = xcalc.sheet ?? workbook.SheetNames[0];

    xCheckProductConfig(product, config, workbook, sheet);

    product.parameters.map(param => {
        const value = config[param.name];
        switch (param.type) {
            case 'select':
                param.options.find(o => o.value === value).selected = true;
                break;
            case 'number':
            case 'quantity':
                param.value = value;
                break;
        }
    });

    product.configPath = Object.values(config).join('/');
    product.quantity = Number(product.parameters.find(p => p.type === 'quantity').value) || null;
    switch (typeof product.weight) {
        case 'string':
            product.weight = workbook.Sheets[sheet][product.weight].v;
            break;
        case 'number':
            product.weight = Number(product.weight) * (product.quantity ?? 1);
            break;
    };
    product.prices.map(price => {
        typeof price.id === 'string' && (price.id = workbook.Sheets[sheet][price.id].v);
        switch (typeof price.qty) {
            case 'string':
                price.qty = workbook.Sheets[sheet][price.qty].v;
                break;
            case 'number':
                price.qty = Number(price.qty) * (product.quantity ?? 1);
                break;
        };
    });

    return strict && configPath !== product.configPath ? null : product;
};

function verifyProductConfig(product, config) {
    return product.parameters.map(param => {
        const value = config[param.name];
        switch (param.type) {
            case 'select':
                return !param.options.find(option => option.value === value) ? false : true;
            case 'number':
            case 'quantity':
                return !Number(value) ? false : true;
        }
    }).every(Boolean);
};

function fixProductConfig(product, config) {
    product.parameters.forEach(param => {
        const value = config[param.name];
        switch (param.type) {
            case 'select':
                if (!param.options.find(option => option.value === value)) {
                    config[param.name] = param.options[0].value;
                };
                break;
            case 'number':
            case 'quantity':
                if (Number(value)) {
                    config[param.name] = Number(value);
                } else {
                    config[param.name] = Number(param.value);
                };
                break;
        }
    });
};

function xCheckProductConfig(product, config, workbook, sheet) {
    const initial = structuredClone(config);

    product.parameters.map(param => {
        const value = config[param.name];
        if (param.cell) workbook.Sheets[sheet][param.cell].v = value;
    });

    XLSX_CALC(workbook, { continue_after_error: true, log_error: true });

    product.parameters.map(param => {
        const value = config[param.name];

        if (param.enabledCell) {
            param.enabled = ["TRUE", 1, true].includes(workbook.Sheets[sheet][param.enabledCell].v);
        };

        if (['number', 'quantity'].includes(param.type)) {
            if (param.min && typeof param.min === 'string') param.min = Number(workbook.Sheets[sheet][param.min].v);
            if (param.max && typeof param.max === 'string') param.max = Number(workbook.Sheets[sheet][param.max].v);
            if (Number(value) > param.max) config[param.name] = param.max;
            if (Number(value) < param.min) config[param.name] = param.min;
        };

        if (param.type === 'select') {
            param.options.map(o => {
                delete o.selected;
                if (o.enabledCell) o.enabled = ["TRUE", 1, true].includes(workbook.Sheets[sheet][o.enabledCell].v);
            });
            config[param.name] = (param.enabled === false
                ? getFallbackOption(param.options)
                : findOptionSelectedOrEnabled(param.options, value)
            ).value;
        };
    });

    return JSON.stringify(initial) !== JSON.stringify(config) ? xCheckProductConfig(product, config, workbook, sheet) : config;
};

function getParamConfig(product, configPath) {
    const params = getProductParamNames(product);
    const values = configPath ? configPath.replace(/^\/|\/$/g, '').split("/") : getProductDefaultParamValues(product);

    return keyValueArraysToObject(params, values);
};

function findOptionSelectedOrEnabled(options, value) {
    return options.find(option => option.value === value && option.enabled !== false) || options.find(option => option.enabled !== false);
};

function getFallbackOption(options) {
    return options.find(option => option.isFallback === true);
}

function getProductDefinition(name) {
    if (!registry.findByNameAndType(name, 'product')?.enabled) return null;

    return require(`../../data/products/${name}.json`);
};

function getProductParamNames(product) {
    return product.parameters.map(param => param.name);
};

function getProductDefaultParamValues(product) {
    return product.parameters.map(getProductParamDefaultValue);
};

function getProductParamDefaultValue(param) {
    switch (param.type) {
        case "select":
            return param.options[0].value;
        case "number":
        case "quantity":
            return String(param.value);
    };
    return param.type;
};
