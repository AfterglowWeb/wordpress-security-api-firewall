<?php
namespace Bromate\SecurityApiFirewall\Admin;

use Bromate\SecurityApiFirewall\Utils\FileUtils;
use Bromate\SecurityApiFirewall\Core\Settings\SettingsAjaxController;

use League\CommonMark\MarkdownConverter;
use League\CommonMark\Environment\Environment;
use League\CommonMark\Extension\SmartPunct\SmartPunctExtension;
use League\CommonMark\Extension\Strikethrough\StrikethroughExtension;
use League\CommonMark\Extension\HeadingPermalink\HeadingPermalinkExtension;
use League\CommonMark\Extension\HeadingPermalink\HeadingPermalinkRenderer;

class Documentation {
	protected static $instance = null;

	public static function register(): void {
		$self = new self();
		add_action( 'wp_ajax_security_api_firewall_documentation', array( $self, 'ajax_documentation' ) );
	}

	public function ajax_documentation() {
		if ( false === SettingsAjaxController::ajax_validate_has_firewall_admin_caps() ) {
			wp_send_json_error( array( 'message' => 'Unauthorized' ), 403 );
		}

		$documentation_pages = self::read_pages();
		wp_send_json_success( $documentation_pages );
	}

	public static function read_pages() {

		$docs_dir = BROMATE_SECURITY_API_FIREWALL_DIR . 'docs';

		if ( ! FileUtils::is_dir( $docs_dir ) ) {
			return array();
		}

		$pages = array(
			array(
				'slug'  => 'presentation',
				'title' => esc_html__( 'Presentation', 'bromate-security-api-firewall' ),
				'html'  => '',
			),
			array(
				'slug'  => 'getting-started',
				'title' => esc_html__( 'Getting Started', 'bromate-security-api-firewall' ),
				'html'  => '',
			),
			array(
				'slug'  => 'hooks',
				'title' => esc_html__( 'Hooks', 'bromate-security-api-firewall' ),
				'html'  => '',
			),
			array(
				'slug'  => 'applications',
				'title' => esc_html__( 'Applications', 'bromate-security-api-firewall' ),
				'html'  => '',
			),
			array(
				'slug'  => 'users',
				'title' => esc_html__( 'Auth. & Rate Limit', 'bromate-security-api-firewall' ),
				'html'  => '',
			),
			array(
				'slug'  => 'models',
				'title' => esc_html__( 'Properties', 'bromate-security-api-firewall' ),
				'html'  => '',
			),
			array(
				'slug'  => 'collections',
				'title' => esc_html__( 'Collections', 'bromate-security-api-firewall' ),
				'html'  => '',
			),
			array(
				'slug'  => 'automations',
				'title' => esc_html__( 'Automations', 'bromate-security-api-firewall' ),
				'html'  => '',
			),
			array(
				'slug'  => 'webhooks',
				'title' => esc_html__( 'Webhooks', 'bromate-security-api-firewall' ),
				'html'  => '',
			),
			array(
				'slug'  => 'mails',
				'title' => esc_html__( 'Emails', 'bromate-security-api-firewall' ),
				'html'  => '',
			),
		);

		$config = array(
			'heading_permalink' => array(
				'html_class'          => 'blank-docs-heading-permalink',
				'id_prefix'           => 'rest_firewall_docs',
				'apply_id_to_heading' => false,
				'heading_class'       => '',
				'fragment_prefix'     => 'rest_firewall_docs',
				'insert'              => 'before',
				'min_heading_level'   => 1,
				'max_heading_level'   => 6,
				'title'               => 'Permalink',
				'symbol'              => HeadingPermalinkRenderer::DEFAULT_SYMBOL,
				'aria_hidden'         => true,
			),
		);

		$environment = new Environment( $config );
		$environment->addExtension( new SmartPunctExtension() );
		$environment->addExtension( new StrikethroughExtension() );
		$environment->addExtension( new HeadingPermalinkExtension() );

		$converter  = new MarkdownConverter( $environment );
		$pages_html = array();
		foreach ( $pages as $page ) {

			$file = realpath( $docs_dir . '/' . $page['slug'] . '.md' );
			if ( ! $file ) {
				$file = realpath( $docs_dir . '/' . $page['slug'] . '/' . $page['slug'] . '.md' );
			}

			if ( false === FileUtils::is_readable( $file ) ) {
				continue;
			}

			$markdown = FileUtils::read_file( $file );
			if ( ! $markdown ) {
				continue;
			}

			$result = $converter->convert( $markdown );
			$html   = $result->getContent();

			$pages_html[] = array(
				'slug'  => $page['slug'],
				'title' => $page['title'],
				'html'  => $html,
			);
		}

		return $pages_html;
	}
}
