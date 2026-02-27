export function formatAddProduct (product, sellerId) {
    
    // Parse UTC ISO strings from client
    const createdAtUTC = new Date(product.created_at);
    const endAtUTC = new Date(product.end_date);

    return {
        seller_id: sellerId,
        category_id: product.category_id,
        name: product.name,
        starting_price: product.start_price.replace(/,/g, ''),
        step_price: product.step_price.replace(/,/g, ''),
        buy_now_price: product.buy_now_price !== '' ? product.buy_now_price.replace(/,/g, '') : null,
        created_at: createdAtUTC,
        end_at: endAtUTC,
        auto_extend: product.auto_extend === '1' ? true : false,
        thumbnail: null,  // to be updated after upload
        description: product.description,
        highest_bidder_id: null,
        current_price: product.start_price.replace(/,/g, ''),
        is_sold: null,
        allow_unrated_bidder: product.allow_new_bidders === '1' ? true : false,
        closed_at: null
    }
}