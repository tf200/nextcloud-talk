<?php

declare(strict_types=1);

namespace OCA\Talk\Service;

use OCP\App\IAppManager;
use OCP\Server;

class OrganizationIntegrationService {
	private const POLICY_SERVICE = 'OCA\\Organization\\Service\\TalkOrganizationPolicyService';

	private ?object $policyService = null;
	private bool $policyResolved = false;

	public function __construct(
		private IAppManager $appManager,
	) {
	}

	public function isGlobalAdmin(?string $userId): bool {
		return $this->callPolicyMethod('isGlobalAdmin', [$userId]) ?? false;
	}

	public function canUserUseTalk(?string $userId): bool {
		if ($userId === null) {
			return true;
		}

		$result = $this->callPolicyMethod('canUserUseTalk', [$userId]);
		return $result ?? true;
	}

	public function canUsersCommunicate(?string $firstUserId, ?string $secondUserId): bool {
		if ($firstUserId === null || $secondUserId === null) {
			return true;
		}

		$result = $this->callPolicyMethod('canUsersCommunicate', [$firstUserId, $secondUserId]);
		return $result ?? true;
	}

	/**
	 * @param string[] $candidateUserIds
	 * @return string[]
	 */
	public function filterReachableUserIds(?string $requestUserId, array $candidateUserIds): array {
		if ($requestUserId === null) {
			return $candidateUserIds;
		}

		$result = $this->callPolicyMethod('filterReachableUserIds', [$requestUserId, $candidateUserIds]);
		return is_array($result) ? array_values($result) : $candidateUserIds;
	}

	/**
	 * @param string[] $roomUserIds
	 */
	public function canUserAccessRoom(?string $requestUserId, array $roomUserIds): bool {
		if ($requestUserId === null) {
			return true;
		}

		$result = $this->callPolicyMethod('canUserAccessRoom', [$requestUserId, $roomUserIds]);
		return $result ?? true;
	}

	private function getPolicyService(): ?object {
		if ($this->policyResolved) {
			return $this->policyService;
		}

		$this->policyResolved = true;
		if (!$this->appManager->isEnabledForAnyone('organization') || !class_exists(self::POLICY_SERVICE)) {
			return null;
		}

		$this->appManager->loadApp('organization');
		$this->policyService = Server::get(self::POLICY_SERVICE);

		return $this->policyService;
	}

	private function callPolicyMethod(string $method, array $arguments): mixed {
		$policyService = $this->getPolicyService();
		if ($policyService === null || !method_exists($policyService, $method)) {
			return null;
		}

		return $policyService->{$method}(...$arguments);
	}
}
