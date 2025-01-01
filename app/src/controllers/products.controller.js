const { getProductDefaultValues, getContainerGridItems, parseGridItem } = require("../services/products.service");
const render = require("../utils/render.utils");

module.exports = {
    getContainer: (req, res) => {
        const { category: categoryName } = req.params;
        const category = parseGridItem(categoryName);
        render(req, res, "products", { items: getContainerGridItems(category.name), title: category.title });
    },
    getContainerMain: (req, res) => {
        render(req, res, "products", { items: getContainerGridItems("home"), title: "Products" });
    },
    getProduct: (req, res) => {
        res.end('getProduct');
    },
    getProductDefault: (req, res) => {
        const { product: productName } = req.params;
        const product = getProductDefaultValues(productName);
        render(req, res, "product", { product, title: product.title });
    },
};
