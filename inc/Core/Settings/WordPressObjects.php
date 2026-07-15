<?php namespace Bromate\SecurityApiFirewall\Core\Settings;

defined( 'ABSPATH' ) || exit;

class WordPressObjects {

	public static function list_post_types(): array {

		$post_types = get_post_types(
			array(
				'show_in_rest' => true,
			),
			'objects'
		);

		if ( empty( $post_types ) ) {
			return array();
		}

		$list = array_map(
			static function ( object $post_type ): array {
				if ( function_exists( 'icl_object_id' ) ) {
					// WPML is active: count only posts in the current admin language.
					$q     = new \WP_Query(
						array(
							'post_type'      => $post_type->name,
							'post_status'    => array( 'publish', 'inherit' ),
							'posts_per_page' => 1,
							'no_found_rows'  => false,
							'fields'         => 'ids',
						)
					);
					$count = (int) $q->found_posts;
				} else {
					$counts = wp_count_posts( $post_type->name );
					$count  = (int) ( ( $counts->publish ?? 0 ) + ( $counts->inherit ?? 0 ) );
				}
				return array(
					'value'     => sanitize_key( $post_type->name ),
					'label'     => property_exists( $post_type->labels, 'singular_name' )
						? sanitize_text_field( $post_type->labels->singular_name )
						: sanitize_key( $post_type->name ),
					'public'    => $post_type->public || $post_type->publicly_queryable,
					'_builtin'  => $post_type->_builtin,
					'type'      => 'post_type',
					'rest_base' => sanitize_key( property_exists( $post_type, 'rest_base' ) ? $post_type->rest_base : $post_type->name ),
					'count'     => $count,
				);
			},
			$post_types
		);

		return array_values( $list );
	}

	public static function list_taxonomies(): array {
		$taxonomies = get_taxonomies(
			array(
				'show_in_rest' => true,
			),
			'objects'
		);

		if ( empty( $taxonomies ) ) {
			return array();
		}

		$list = array_map(
			static function ( object $taxonomy ): array {
				if ( function_exists( 'icl_object_id' ) ) {
					// WPML is active: count terms in the current admin language only.
					$current_lang = apply_filters( 'wpml_current_language', null );
					$count_args   = array(
						'taxonomy'   => $taxonomy->name,
						'hide_empty' => false,
					);
					if ( $current_lang ) {
						$count_args['lang'] = $current_lang;
					}
					$count = wp_count_terms( $count_args );
				} else {
					$count = wp_count_terms(
						array(
							'taxonomy'   => $taxonomy->name,
							'hide_empty' => false,
						)
					);
				}
				return array(
					'value'    => sanitize_key( $taxonomy->name ),
					'label'    => property_exists( $taxonomy->labels, 'singular_name' )
						? sanitize_text_field( $taxonomy->labels->singular_name )
						: sanitize_key( $taxonomy->name ),
					'public'   => $taxonomy->public,
					'_builtin' => $taxonomy->_builtin,
					'type'     => 'taxonomy',
					'count'    => is_wp_error( $count ) ? 0 : (int) $count,
				);
			},
			$taxonomies
		);

		return array_values( $list );
	}

	public static function list_authors(): array {
		return array(
			array(
				'id'           => 0,
				'display_name' => __( 'Author', 'bromate-security-api-firewall' ),
			),
		);
	}

	public static function list_rest_api_object_types(): array {
		return array_merge(
			self::list_post_types(),
			self::list_taxonomies(),
			self::list_authors()
		);
	}
}
