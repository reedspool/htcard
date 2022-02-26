module.exports = {
    content: ["./server/www/**/*.{js,html}", "./server/views/**/*.{ejs,html}"],
    theme: {
        extend: {
            spacing: {
                sm: '16px',
                md: '24px',
                lg: '32px',
                xl: '40px'
            }
        },
    },
    plugins: [],
}
